import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Brain, ChevronRight, Copy, Check, Wrench } from "lucide-react";
import type { Message } from "@/store/types";

interface ChatMessageProps {
  message: Message;
  isActivelyStreaming?: boolean;
}

function formatToolResult(result: unknown): string {
  if (typeof result === "string") return result;
  if (result === null || result === undefined) return "No output";
  return JSON.stringify(result, null, 2);
}

export function ChatMessage({
  message,
  isActivelyStreaming = false,
}: ChatMessageProps) {
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasReasoning = !!message.reasoning?.trim();
  const hasContent = !!message.content.trim();
  const isReasoningPhase = isActivelyStreaming && hasReasoning && !hasContent;
  const showReasoning = hasReasoning && (reasoningOpen || isReasoningPhase);

  function handleCopy() {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={`message ${message.role}`}>
      {hasReasoning && (
        <button
          className={`reasoning-toggle ${showReasoning ? "open" : ""}`}
          onClick={() => setReasoningOpen((v) => !v)}
          type="button"
        >
          <Brain />
          <span>{isReasoningPhase ? "Thinking..." : "Thinking"}</span>
          <ChevronRight className="chevron" />
        </button>
      )}
      {showReasoning && (
        <div className="reasoning-content">
          {message.reasoning}
          {isReasoningPhase && <span className="streaming-cursor" />}
        </div>
      )}
      <div className="message-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code: ({ className, children }) => {
              const isInline = !className;
              if (isInline) {
                return <code>{children}</code>;
              }
              return (
                <pre>
                  <code className={className}>{children}</code>
                </pre>
              );
            },
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
      {hasContent && (
        <button
          className="copy-btn"
          onClick={handleCopy}
          type="button"
          aria-label="Copy message"
        >
          {copied ? <Check /> : <Copy />}
        </button>
      )}
      {message.toolInvocations?.map((invocation) => (
        <div key={invocation.toolCallId} className="tool-card">
          <div className="tool-card-header">
            <Wrench size={12} />
            <span className="tool-name">{invocation.toolName}</span>
            <span className="tool-state">
              {invocation.state === "call" ? "Running..." : "Done"}
            </span>
          </div>
          {invocation.state === "result" && (
            <pre className="tool-result">
              {formatToolResult(invocation.result)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
