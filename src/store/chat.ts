import { create } from "zustand";
import type { ChatStoreState, Message, MessagePart } from "./types";

export const useChatStore = create<ChatStoreState>((set) => ({
  messages: [],
  isStreaming: false,
  error: null,

  addMessage: (message: Message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  appendPart: (messageId: string, part: MessagePart) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId ? { ...msg, parts: [...msg.parts, part] } : msg,
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

  setStreaming: (isStreaming: boolean) => set({ isStreaming }),

  setError: (error: string | null) => set({ error }),

  clearMessages: () => set({ messages: [], error: null }),
}));
