import { useRef, useCallback } from "react";
import { type TextStreamPart } from "ai";
import { useChatStore } from "@/store/chat";
import { type AgentTools } from "@/lib/tools";
import { createAgent } from "@/lib/agent";
import { sendToBackground } from "@/lib/messaging";
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
  onToolResult: (toolCallId: string, toolName: string, output: unknown) => void;
  onToolError: (toolCallId: string, toolName: string, error: unknown) => void;
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
      handlers.onToolResult(event.toolCallId, event.toolName, event.output);
      break;

    case "tool-error":
      handlers.onToolError(event.toolCallId, event.toolName, event.error);
      break;

    case "error":
      handlers.onError(event.error);
      break;
  }
}

export function useStreamingChat({ apiKey, model }: UseStreamingChatOptions) {
  const {
    addMessage,
    appendPart,
    updateLastPart,
    replacePart,
    setStreaming,
    setError,
  } = useChatStore();

  const abortRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

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

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let pageContext: { url: string; title: string } | undefined;
      try {
        const pageContent = await sendToBackground("GET_PAGE_CONTENT");
        pageContext = { url: pageContent.url, title: pageContent.title };
      } catch {
        // Page context unavailable (e.g., chrome:// page)
      }

      const agent = createAgent(apiKey, model, pageContext);

      const coreMessages = useChatStore
        .getState()
        .messages.slice(0, -1)
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: getTextFromParts(m.parts),
        }));

      const result = await agent.stream({
        messages: coreMessages,
        abortSignal: controller.signal,
      });

      let currentPartType:
        | "text"
        | "reasoning"
        | "tool-call"
        | "tool-result"
        | "tool-error"
        | null = null;
      let accumulatedText = "";
      let accumulatedReasoning = "";
      let hasGrouped = false;

      for await (const event of result.fullStream) {
        if (controller.signal.aborted) break;

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
            if (!hasGrouped) {
              hasGrouped = true;
              sendToBackground("FIND_OR_CREATE_PAVO_GROUP").catch(() => {});
            }
            currentPartType = "tool-call";
            appendPart(assistantId, {
              type: "tool-call",
              toolCallId,
              toolName,
              args: input as Record<string, unknown>,
            });
          },
          onToolResult(toolCallId, toolName, output) {
            currentPartType = "tool-result";
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
          onToolError(toolCallId, toolName, error) {
            currentPartType = "tool-error";
            replacePart(assistantId, toolCallId, {
              type: "tool-error",
              toolCallId,
              toolName: toolName ?? "unknown",
              error: String(error),
            });
          },
        });
      }
    } catch (err) {
      if (controller.signal.aborted) {
        // User aborted — keep existing parts
      } else {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        useChatStore.setState((state) => ({
          messages: state.messages.filter((m) => m.id !== assistantId),
        }));
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
    }
  };

  return { sendMessage, abort };
}
