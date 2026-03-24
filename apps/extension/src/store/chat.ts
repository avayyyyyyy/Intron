import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import type { ChatStoreState, Message, MessagePart, Conversation } from "./types";
import { getTextFromParts } from "./types";

// ─── Chrome Storage Adapter ──────────────────────────────────────────────────

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingWrite: { key: string; value: string } | null = null;

function flushPendingWrite() {
  if (debounceTimer) clearTimeout(debounceTimer);
  if (pendingWrite) {
    chrome.storage.local.set({ [pendingWrite.key]: pendingWrite.value });
    pendingWrite = null;
    debounceTimer = null;
  }
}

// Flush on page unload so fire-and-forget saves don't get lost
window.addEventListener("beforeunload", flushPendingWrite);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushPendingWrite();
});

const chromeStorage: StateStorage = {
  getItem: (key) =>
    new Promise((resolve) => {
      // If there's a pending write for this key, return it directly (avoid stale read)
      if (pendingWrite?.key === key) {
        resolve(pendingWrite.value);
        return;
      }
      chrome.storage.local.get(key, (result) =>
        resolve((result[key] ?? null) as string | null),
      );
    }),
  // Debounced writes — coalesces rapid streaming updates into one IPC
  setItem: (key, value) =>
    new Promise<void>((resolve) => {
      pendingWrite = { key, value };
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        flushPendingWrite();
        resolve();
      }, 500);
    }),
  removeItem: (key) =>
    new Promise<void>((resolve) => {
      chrome.storage.local.remove(key, resolve);
    }),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function chatKey(id: string) {
  return `intron-chat-${id}`;
}

function generateId() {
  return crypto.randomUUID();
}

function deriveTitle(messages: Message[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New chat";
  const text = getTextFromParts(first.parts);
  return text.slice(0, 50) || "New chat";
}

function trimForStorage(messages: Message[]): Message[] {
  const KEEP_IMAGES = 10;
  const cutoff = messages.length - KEEP_IMAGES;
  return messages.map((m, i) => {
    if (i >= cutoff) return m;
    return {
      ...m,
      parts: m.parts.map((p) =>
        p.type === "image" ? { ...p, image: "" } : p,
      ),
    };
  });
}

async function saveMessages(conversationId: string, messages: Message[]) {
  const trimmed = trimForStorage(messages);
  // Write immediately — bypass the debounced storage adapter since this is
  // a deliberate user action (new chat, switch conversation), not streaming.
  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ [chatKey(conversationId)]: JSON.stringify(trimmed) }, resolve);
  });
}

async function loadMessages(conversationId: string): Promise<Message[]> {
  const raw = await chromeStorage.getItem(chatKey(conversationId));
  if (typeof raw !== "string") return [];
  try {
    const messages = JSON.parse(raw) as Message[];
    for (const m of messages) m.createdAt = new Date(m.createdAt);
    return messages;
  } catch {
    return [];
  }
}

/** Save current conversation to storage and update the conversations list */
function saveCurrentToList(
  messages: Message[],
  activeId: string,
  conversations: Conversation[],
): Conversation[] {
  const existing = conversations.find((c) => c.id === activeId);
  const entry: Conversation = {
    id: activeId,
    title: deriveTitle(messages),
    createdAt: existing?.createdAt ?? new Date(),
    updatedAt: new Date(),
    messageCount: messages.length,
  };
  return [entry, ...conversations.filter((c) => c.id !== activeId)];
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useChatStore = create<ChatStoreState>()(
  persist(
    (set, get) => ({
      messages: [],
      isStreaming: false,
      error: null,
      activeConversationId: generateId(),
      conversations: [],

      addMessage: (message: Message) =>
        set((state) => ({ messages: [...state.messages, message] })),

      appendPart: (messageId: string, part: MessagePart) =>
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === messageId
              ? { ...msg, parts: [...msg.parts, part] }
              : msg,
          ),
        })),

      updateLastPart: (messageId: string, content: string) =>
        set((state) => ({
          messages: state.messages.map((msg) => {
            if (msg.id !== messageId || msg.parts.length === 0) return msg;
            const parts = [...msg.parts];
            const last = parts[parts.length - 1];
            if (last.type === "text" || last.type === "reasoning") {
              parts[parts.length - 1] = { ...last, content };
            }
            return { ...msg, parts };
          }),
        })),

      replacePart: (messageId: string, toolCallId: string, part: MessagePart) =>
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  parts: msg.parts.map((p) =>
                    "toolCallId" in p && p.toolCallId === toolCallId ? part : p,
                  ),
                }
              : msg,
          ),
        })),

      updateTaskList: (messageId: string, sessionId: string, part: Extract<MessagePart, { type: "task-list" }>) =>
        set((state) => ({
          messages: state.messages.map((msg) => {
            if (msg.id !== messageId) return msg;
            // Replace existing task-list with same sessionId, or append
            const existingIdx = msg.parts.findIndex(
              (p) => p.type === "task-list" && p.sessionId === sessionId,
            );
            if (existingIdx >= 0) {
              const parts = [...msg.parts];
              parts[existingIdx] = part;
              return { ...msg, parts };
            }
            return { ...msg, parts: [...msg.parts, part] };
          }),
        })),

      setStreaming: (isStreaming: boolean) => set({ isStreaming }),
      setError: (error: string | null) => set({ error }),
      clearMessages: () => set({ messages: [], error: null }),

      newConversation: () => {
        const { messages, activeConversationId, conversations } = get();

        // Update UI instantly — don't wait for storage
        const newId = generateId();
        const updatedConversations = messages.length > 0
          ? saveCurrentToList(messages, activeConversationId, conversations)
          : conversations;

        set({
          messages: [],
          error: null,
          activeConversationId: newId,
          conversations: updatedConversations,
        });

        // Save old conversation to storage in background (fire-and-forget)
        if (messages.length > 0) {
          saveMessages(activeConversationId, messages);
        }
      },

      loadConversation: async (id: string) => {
        const { messages, activeConversationId, conversations } = get();

        // Save current + load target in parallel
        const [, loaded] = await Promise.all([
          messages.length > 0
            ? saveMessages(activeConversationId, messages)
            : Promise.resolve(),
          loadMessages(id),
        ]);

        const updatedConversations =
          messages.length > 0
            ? saveCurrentToList(messages, activeConversationId, conversations)
            : conversations;

        set({
          messages: loaded,
          error: null,
          activeConversationId: id,
          conversations: updatedConversations,
        });
      },

      deleteConversation: async (id: string) => {
        await chromeStorage.removeItem(chatKey(id));
        set((state) => ({
          conversations: state.conversations.filter((c) => c.id !== id),
        }));
      },
    }),
    {
      name: "intron-chat",
      storage: createJSONStorage(() => chromeStorage),
      // Don't persist messages here — they're saved per-conversation via saveMessages
      partialize: (state) => ({
        activeConversationId: state.activeConversationId,
        conversations: state.conversations,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.conversations) {
          for (const c of state.conversations) {
            c.createdAt = new Date(c.createdAt);
            c.updatedAt = new Date(c.updatedAt);
          }
        }
        // Always start fresh on extension open
        if (state) {
          state.messages = [];
          state.activeConversationId = generateId();
        }
      },
    },
  ),
);
