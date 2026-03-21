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
  Navigation,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  MousePointer,
  Type,
  Command,
  MoveVertical,
  MousePointer2,
  ListChecks,
  ClipboardList,
  LayoutDashboard,
  Info,
  Link,
  Timer,
  Database,
  Terminal,
  LayoutGrid,
  Plus,
  ArrowLeftRight,
  X,
} from "lucide-react";
import type { Message, MessagePart } from "@/store/types";
import { getTextFromParts } from "@/store/types";
import { TOOL_META, type ToolName } from "@/lib/tools";

interface ChatMessageProps {
  message: Message;
  isActivelyStreaming?: boolean;
}

const TOOL_ICONS: Record<string, typeof Clock> = {
  Clock,
  Camera,
  Globe,
  Navigation,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  MousePointer,
  Type,
  Command,
  MoveVertical,
  MousePointer2,
  ListChecks,
  ClipboardList,
  LayoutDashboard,
  Info,
  Link,
  Timer,
  Database,
  Terminal,
  LayoutGrid,
  Plus,
  ArrowLeftRight,
  X,
};

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
  part: Extract<
    MessagePart,
    { type: "tool-call" | "tool-result" | "tool-error" }
  >;
  isComplete: boolean;
}) {
  const Icon = getToolIcon(part.toolName);
  const isRunning = !isComplete && part.type === "tool-call";
  const isError = part.type === "tool-error";

  return (
    <div
      className={`tool-card ${isRunning ? "running" : ""} ${isError ? "error" : ""}`}
    >
      <div className="tool-card-header">
        <Icon size={12} />
        <span className="tool-label">{getToolLabel(part.toolName)}</span>
        {isRunning && <span className="tool-state">running</span>}
        {isError && <span className="tool-state error">failed</span>}
      </div>
      {isComplete && part.type === "tool-result" && (
        <ToolResultContent toolName={part.toolName} result={part.result} />
      )}
      {isError && part.type === "tool-error" && (
        <div className="tool-error-text">{part.error}</div>
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
  if (result === null || result === undefined) {
    return <div className="tool-text muted">No result</div>;
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

  if (toolName === "getPageStructure" && hasKey(result, "elements")) {
    const elements = (
      result as { elements: Array<{ tag: string; label: string }> }
    ).elements;
    return (
      <div className="tool-text">
        {elements.slice(0, 8).map((el, i) => (
          <div key={i} className="tool-element">
            <span className="tool-element-tag">&lt;{el.tag}&gt;</span>
            <span>{el.label.slice(0, 50)}</span>
          </div>
        ))}
        {elements.length > 8 && (
          <span className="tool-text muted">+{elements.length - 8} more</span>
        )}
      </div>
    );
  }

  if (toolName === "getPageLinks" && hasKey(result, "links")) {
    const links = (result as { links: Array<{ text: string; href: string }> })
      .links;
    return (
      <div className="tool-text">
        {links.slice(0, 5).map((l, i) => (
          <div key={i} className="tool-link">
            <span>{l.text || l.href.slice(0, 60)}</span>
          </div>
        ))}
        {links.length > 5 && (
          <span className="tool-text muted">
            +{links.length - 5} more links
          </span>
        )}
      </div>
    );
  }

  if (toolName === "getElementInfo" && hasStringKeys(result, "tag")) {
    const r = result as { tag: string; text: string; visible: boolean };
    return (
      <div className="tool-text">
        <span className="tool-element-tag">&lt;{r.tag}&gt;</span>
        {r.text && <span> — {r.text.slice(0, 80)}</span>}
        {!r.visible && <span className="muted"> (hidden)</span>}
      </div>
    );
  }

  if (toolName === "navigateTo" && hasStringKeys(result, "finalUrl")) {
    return <div className="tool-text">Navigated to {result.finalUrl}</div>;
  }

  if (toolName === "clickElement" && hasStringKeys(result, "message")) {
    return <div className="tool-text">{result.message}</div>;
  }

  if (toolName === "typeText" && hasStringKeys(result, "message")) {
    return <div className="tool-text">{result.message}</div>;
  }

  if (toolName === "waitForElement" && hasKey(result, "found")) {
    const r = result as { found: boolean; elapsed: number };
    return (
      <div className="tool-text">
        {r.found ? `Found after ${r.elapsed}ms` : `Not found (${r.elapsed}ms)`}
      </div>
    );
  }

  if (toolName === "fillForm" && hasKey(result, "filledCount")) {
    const r = result as { filledCount: number; errors: string[] };
    return (
      <div className="tool-text">
        Filled {r.filledCount} fields
        {r.errors.length > 0 && (
          <span className="tool-error-text"> ({r.errors.length} errors)</span>
        )}
      </div>
    );
  }

  if (toolName === "getTabsList" && hasKey(result, "tabs")) {
    const tabs = (result as { tabs: Array<{ title: string; active: boolean }> })
      .tabs;
    return (
      <div className="tool-text">
        {tabs.slice(0, 5).map((t, i) => (
          <div key={i} className={t.active ? "tool-tab active" : "tool-tab"}>
            {t.active ? "→ " : "  "}
            {t.title || "Untitled"}
          </div>
        ))}
        {tabs.length > 5 && (
          <span className="muted">+{tabs.length - 5} more tabs</span>
        )}
      </div>
    );
  }

  if (toolName === "extractData" && hasKey(result, "items")) {
    const items = (result as { items: Array<{ text?: string }>; count: number })
      .items;
    return (
      <div className="tool-text">
        Extracted {items.length} items
        {items.slice(0, 3).map((item, i) => (
          <div key={i} className="tool-item">
            {item.text?.slice(0, 80)}
          </div>
        ))}
      </div>
    );
  }

  if (toolName === "selectOption" && hasStringKeys(result, "selectedValue")) {
    return <div className="tool-text">Selected: {result.selectedValue}</div>;
  }

  if (
    toolName === "goBack" ||
    toolName === "goForward" ||
    toolName === "reloadPage"
  ) {
    return <div className="tool-text">Done</div>;
  }

  if (toolName === "openTab" && hasStringKeys(result, "url")) {
    return <div className="tool-text">Opened {result.url}</div>;
  }

  if (toolName === "closeTab") {
    return <div className="tool-text">Tab closed</div>;
  }

  if (toolName === "switchTab") {
    return <div className="tool-text">Switched tab</div>;
  }

  if (typeof result === "string") {
    return <div className="tool-text">{result.slice(0, 200)}</div>;
  }

  if (hasKey(result, "result")) {
    const val = (result as { result: unknown }).result;
    return (
      <div className="tool-text">
        {typeof val === "string"
          ? val.slice(0, 200)
          : JSON.stringify(val).slice(0, 200)}
      </div>
    );
  }

  return <div className="tool-text muted">Completed</div>;
}

function hasKey(obj: unknown, key: string): boolean {
  return typeof obj === "object" && obj !== null && key in obj;
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

          case "tool-error":
            return (
              <ToolCard key={part.toolCallId} part={part} isComplete={false} />
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
