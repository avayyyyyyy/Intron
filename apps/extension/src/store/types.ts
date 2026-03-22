export type MessagePart =
  | { type: "reasoning"; content: string }
  | { type: "text"; content: string }
  | { type: "image"; image: string; mediaType?: string }
  | {
      type: "tool-call";
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
    }
  | {
      type: "tool-result";
      toolCallId: string;
      toolName: string;
      result: unknown;
    }
  | {
      type: "tool-error";
      toolCallId: string;
      toolName: string;
      error: string;
    };

export interface Message {
  id: string;
  role: "user" | "assistant";
  parts: MessagePart[];
  createdAt: Date;
}

export interface ChatStoreState {
  messages: Message[];
  isStreaming: boolean;
  error: string | null;
  addMessage: (message: Message) => void;
  appendPart: (messageId: string, part: MessagePart) => void;
  updateLastPart: (messageId: string, content: string) => void;
  replacePart: (
    messageId: string,
    toolCallId: string,
    part: MessagePart,
  ) => void;
  setStreaming: (isStreaming: boolean) => void;
  setError: (error: string | null) => void;
  clearMessages: () => void;
}

export function getTextFromParts(parts: MessagePart[]): string {
  return parts
    .filter(
      (p): p is Extract<MessagePart, { type: "text" }> => p.type === "text",
    )
    .map((p) => p.content)
    .join("\n\n");
}
