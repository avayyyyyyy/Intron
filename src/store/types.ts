export type ToolInvocation =
  | {
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
      state: "call";
    }
  | {
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
      state: "result";
      result: unknown;
    };

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  toolInvocations?: ToolInvocation[];
  createdAt: Date;
}

export interface ChatStoreState {
  messages: Message[];
  isStreaming: boolean;
  error: string | null;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, content: string) => void;
  updateReasoning: (id: string, reasoning: string) => void;
  updateToolInvocations: (
    id: string,
    toolInvocations: ToolInvocation[],
  ) => void;
  setStreaming: (isStreaming: boolean) => void;
  setError: (error: string | null) => void;
  clearMessages: () => void;
}
