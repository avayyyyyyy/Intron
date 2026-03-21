import { create } from "zustand";
import type { ChatStoreState, Message, ToolInvocation } from "./types";

export const useChatStore = create<ChatStoreState>((set) => ({
  messages: [],
  isStreaming: false,
  error: null,

  addMessage: (message: Message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  updateMessage: (id: string, content: string) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, content } : msg,
      ),
    })),

  updateReasoning: (id: string, reasoning: string) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, reasoning } : msg,
      ),
    })),

  updateToolInvocations: (id: string, toolInvocations: ToolInvocation[]) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, toolInvocations } : msg,
      ),
    })),

  setStreaming: (isStreaming: boolean) => set({ isStreaming }),

  setError: (error: string | null) => set({ error }),

  clearMessages: () => set({ messages: [], error: null }),
}));
