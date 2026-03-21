import { streamText, stepCountIs, type TextStreamPart } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { useChatStore } from "@/store/chat";
import { agentTools, type AgentTools } from "@/lib/tools";
import type { Message, ToolInvocation } from "@/store/types";

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
  const {
    addMessage,
    updateMessage,
    updateReasoning,
    updateToolInvocations,
    setStreaming,
    setError,
  } = useChatStore();

  const sendMessage = async (content: string) => {
    if (!apiKey) {
      setError("Please add your API key in Settings");
      return;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date(),
    };
    addMessage(userMessage);

    const assistantId = crypto.randomUUID();
    addMessage({
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: new Date(),
    });

    setStreaming(true);
    setError(null);

    try {
      const openrouter = createOpenRouter({ apiKey });

      const coreMessages = useChatStore
        .getState()
        .messages.slice(0, -1)
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      const result = streamText({
        model: openrouter.chat(model),
        system:
          "You are Pavo, a helpful AI assistant in a Chrome extension. Provide clear, concise responses. You have access to tools — use them when relevant.",
        messages: coreMessages,
        tools: agentTools,
        stopWhen: stepCountIs(3),
        providerOptions: {
          openrouter: {
            reasoning: {
              max_tokens: 1500,
            },
          },
        },
      });

      let accumulated = "";
      let accumulatedReasoning = "";
      const toolInvocations: ToolInvocation[] = [];

      for await (const event of result.fullStream) {
        handleStreamEvent(event, {
          onTextDelta(text) {
            accumulated += text;
            updateMessage(assistantId, accumulated);
          },
          onReasoningDelta(text) {
            accumulatedReasoning += text;
            updateReasoning(assistantId, accumulatedReasoning);
          },
          onToolCall(toolCallId, toolName, input) {
            toolInvocations.push({
              toolCallId,
              toolName,
              args: input as Record<string, unknown>,
              state: "call",
            });
            updateToolInvocations(assistantId, [...toolInvocations]);
          },
          onToolResult(toolCallId, output) {
            const idx = toolInvocations.findIndex(
              (t) => t.toolCallId === toolCallId,
            );
            if (idx !== -1) {
              toolInvocations[idx] = {
                ...toolInvocations[idx],
                state: "result",
                result: output,
              };
              updateToolInvocations(assistantId, [...toolInvocations]);
            }
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
