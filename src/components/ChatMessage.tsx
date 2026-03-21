import { useState, useEffect, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Brain,
  ChevronRight,
  Copy,
  Check,
  Clock,
  Globe,
  Camera,
} from "lucide-react";
import type { Message, MessagePart } from "@/store/types";
import { getTextFromParts } from "@/store/types";
import { TOOL_META, type ToolName } from "@/lib/tools";

interface ChatMessageProps {
  message: Message;
  isActivelyStreaming?: boolean;
}

const TOOL_ICONS: Record<string, typeof Clock> = { Clock, Camera, Globe };

function getToolIcon(toolName: string): typeof Clock {
  const meta = toolName in TOOL_META ? TOOL_META[toolName as ToolName] : null;
  return meta ? (TOOL_ICONS[meta.iconName] ?? Globe) : Globe;
}

function getToolLabel(toolName: string): string {
  return toolName in TOOL_META
    ? TOOL_META[toolName as ToolName].label
    : toolName;
}

function hasStringKeys<K extends string>(
  obj: unknown,
  ...keys: K[]
): obj is Record<K, string> {
  return (
    typeof obj === "object" &&
    obj !== null &&
    keys.every(
      (k) =>
        k in obj && typeof (obj as Record<string, unknown>)[k] === "string",
    )
  );
}

const markdownComponents = {
  code: ({
    className,
    children,
  }: {
    className?: string;
    children?: React.ReactNode;
  }) => {
    const isInline = !className;
    if (isInline) return <code>{children}</code>;
    return (
      <pre>
        <code className={className}>{children}</code>
      </pre>
    );
  },
  citations: ({ children }: { children?: React.ReactNode }) => (
    <div className="citation">{children}</div>
  ),
};

function ToolCard({
  part,
  isComplete,
}: {
  part: Extract<MessagePart, { type: "tool-call" | "tool-result" }>;
  isComplete: boolean;
}) {
  const Icon = getToolIcon(part.toolName);

  return (
    <div className={`tool-card ${!isComplete ? "shimmer" : ""}`}>
      <div className="tool-card-header">
        <Icon size={12} />
        <span className="tool-label">{getToolLabel(part.toolName)}</span>
        {!isComplete && <span className="tool-state">running</span>}
      </div>
      {isComplete && part.type === "tool-result" && (
        <ToolResultContent toolName={part.toolName} result={part.result} />
      )}
    </div>
  );
}

function ToolResultContent({
  toolName,
  result,
}: {
  toolName: string;
  result: unknown;
}) {
  if (toolName === "getTime" && hasStringKeys(result, "formatted")) {
    return (
      <div className="tool-text">
        <span className="tool-called">Called getTime</span>
        <span>{result.formatted}</span>
      </div>
    );
  }

  if (toolName === "getScreenshot" && hasStringKeys(result, "imageDataUrl")) {
    return (
      <img
        src={result.imageDataUrl}
        alt="Screenshot"
        className="tool-screenshot"
      />
    );
  }

  if (toolName === "getPageContent" && hasStringKeys(result, "title", "url")) {
    return (
      <div className="tool-text">
        <span className="tool-page-title">{result.title}</span>
        <span className="tool-page-url">{result.url}</span>
      </div>
    );
  }

  return (
    <pre className="tool-text">
      {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
    </pre>
  );
}

export function ChatMessage({
  message,
  isActivelyStreaming = false,
}: ChatMessageProps) {
  const [collapsedReasoning, setCollapsedReasoning] = useState<Set<number>>(
    new Set(),
  );
  const [userToggled, setUserToggled] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);
  const wasStreaming = useRef(false);
  const partsRef = useRef(message.parts);
  const userToggledRef = useRef(userToggled);
  partsRef.current = message.parts;
  userToggledRef.current = userToggled;

  useEffect(() => {
    if (wasStreaming.current && !isActivelyStreaming) {
      const toCollapse: number[] = [];
      partsRef.current.forEach((p, i) => {
        if (p.type === "reasoning" && !userToggledRef.current.has(i)) {
          toCollapse.push(i);
        }
      });
      if (toCollapse.length > 0) {
        setCollapsedReasoning((prev) => new Set([...prev, ...toCollapse]));
      }
    }
    wasStreaming.current = isActivelyStreaming;
  }, [isActivelyStreaming]);

  const completedToolIds = useMemo(
    () =>
      new Set(
        message.parts
          .filter(
            (p): p is Extract<MessagePart, { type: "tool-result" }> =>
              p.type === "tool-result",
          )
          .map((p) => p.toolCallId),
      ),
    [message.parts],
  );

  const hasContent = message.parts.some(
    (p) => p.type === "text" && p.content.trim(),
  );

  function handleCopy() {
    navigator.clipboard.writeText(getTextFromParts(message.parts));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function toggleReasoning(index: number) {
    setUserToggled((prev) => new Set([...prev, index]));
    setCollapsedReasoning((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div className={`message ${message.role}`}>
      {message.parts.map((part, index) => {
        switch (part.type) {
          case "reasoning": {
            if (part.content === "[REDACTED]") return null;
            const isStreaming =
              isActivelyStreaming && index === message.parts.length - 1;
            const isOpen = isStreaming || !collapsedReasoning.has(index);
            return (
              <div key={index}>
                <button
                  className={`reasoning-toggle ${isOpen ? "open" : ""}`}
                  onClick={() => toggleReasoning(index)}
                  type="button"
                >
                  <Brain />
                  <span>{isStreaming ? "Thinking..." : "Thinking"}</span>
                  <ChevronRight className="chevron" />
                </button>
                <div className={`reasoning-content ${isOpen ? "visible" : ""}`}>
                  {part.content}
                  {isStreaming && <span className="streaming-cursor" />}
                </div>
              </div>
            );
          }

          case "text":
            return (
              <div key={index} className="message-content">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {part.content}
                </ReactMarkdown>
              </div>
            );

          case "tool-call":
            if (completedToolIds.has(part.toolCallId)) return null;
            return (
              <ToolCard key={part.toolCallId} part={part} isComplete={false} />
            );

          case "tool-result":
            return (
              <ToolCard key={part.toolCallId} part={part} isComplete={true} />
            );
        }
      })}

      {hasContent && !isActivelyStreaming && (
        <button
          className="copy-btn"
          onClick={handleCopy}
          type="button"
          aria-label="Copy message"
        >
          {copied ? <Check /> : <Copy />}
        </button>
      )}
    </div>
  );
}
