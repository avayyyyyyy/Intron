import { type TextStreamPart } from "ai";
import { useChatStore } from "@/store/chat";
import { type AgentTools } from "@/lib/tools";
import { createAgent } from "@/lib/agent";
import type { Message } from "@/store/types";
import { getTextFromParts } from "@/store/types";

interface UseStreamingChatOptions {
  apiKey: string;
  model: string;
}

type StreamEvent = TextStreamPart<AgentTools>;

interface StreamEventHandlers {
  onTextDelta: (text: string) => void;
  onReasoningDelta: (text: string) => void;
  onToolCall: (toolCallId: string, toolName: string, input: unknown) => void;
  onToolResult: (toolCallId: string, output: unknown) => void;
  onError: (error: unknown) => void;
}

function handleStreamEvent(
  event: StreamEvent,
  handlers: StreamEventHandlers,
): void {
  switch (event.type) {
    case "text-delta":
      handlers.onTextDelta(event.text);
      break;

    case "reasoning-delta":
      handlers.onReasoningDelta(event.text);
      break;

    case "tool-call":
      handlers.onToolCall(event.toolCallId, event.toolName, event.input);
      break;

    case "tool-result":
      handlers.onToolResult(event.toolCallId, event.output);
      break;

    case "error":
      handlers.onError(event.error);
      break;
  }
}

export function useStreamingChat({ apiKey, model }: UseStreamingChatOptions) {
  const { addMessage, appendPart, updateLastPart, setStreaming, setError } =
    useChatStore();

  const sendMessage = async (content: string) => {
    if (!apiKey) {
      setError("Please add your API key in Settings");
      return;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      parts: [{ type: "text", content }],
      createdAt: new Date(),
    };
    addMessage(userMessage);

    const assistantId = crypto.randomUUID();
    addMessage({
      id: assistantId,
      role: "assistant",
      parts: [],
      createdAt: new Date(),
    });

    setStreaming(true);
    setError(null);

    try {
      const agent = createAgent(apiKey, model);

      const coreMessages = useChatStore
        .getState()
        .messages.slice(0, -1)
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: getTextFromParts(m.parts),
        }));

      const result = await agent.stream({
        messages: coreMessages,
      });

      let currentPartType:
        | "text"
        | "reasoning"
        | "tool-call"
        | "tool-result"
        | null = null;
      let accumulatedText = "";
      let accumulatedReasoning = "";

      for await (const event of result.fullStream) {
        handleStreamEvent(event, {
          onTextDelta(text) {
            if (currentPartType !== "text") {
              currentPartType = "text";
              accumulatedText = text;
              appendPart(assistantId, { type: "text", content: text });
            } else {
              accumulatedText += text;
              updateLastPart(assistantId, accumulatedText);
            }
          },
          onReasoningDelta(text) {
            if (currentPartType !== "reasoning") {
              currentPartType = "reasoning";
              accumulatedReasoning = text;
              appendPart(assistantId, { type: "reasoning", content: text });
            } else {
              accumulatedReasoning += text;
              updateLastPart(assistantId, accumulatedReasoning);
            }
          },
          onToolCall(toolCallId, toolName, input) {
            currentPartType = "tool-call";
            appendPart(assistantId, {
              type: "tool-call",
              toolCallId,
              toolName,
              args: input as Record<string, unknown>,
            });
          },
          onToolResult(toolCallId, output) {
            currentPartType = "tool-result";
            const msg = useChatStore
              .getState()
              .messages.find((m) => m.id === assistantId);
            const callPart = msg?.parts.find(
              (p) => p.type === "tool-call" && p.toolCallId === toolCallId,
            );
            const toolName =
              callPart && "toolName" in callPart
                ? callPart.toolName
                : "unknown";
            appendPart(assistantId, {
              type: "tool-result",
              toolCallId,
              toolName,
              result: output,
            });
          },
          onError(error) {
            setError(String(error));
          },
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      useChatStore.setState((state) => ({
        messages: state.messages.filter((m) => m.id !== assistantId),
      }));
    } finally {
      setStreaming(false);
    }
  };

  return { sendMessage };
}
