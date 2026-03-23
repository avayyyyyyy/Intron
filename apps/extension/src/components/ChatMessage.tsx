import { useState, useEffect, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Brain, ChevronRight, Copy, Check } from "lucide-react";
import type { Message, MessagePart } from "@/store/types";
import { getTextFromParts } from "@/store/types";
import { Button } from "@/components/ui/button";

interface ChatMessageProps {
  message: Message;
  isActivelyStreaming?: boolean;
}

const TOOL_LABELS: Record<string, [running: string, done: string]> = {
  getScreenshot: ["Taking screenshot", "Screenshot captured"],
  getPageContent: ["Extracting page content", "Page content extracted"],
  navigateTo: ["Navigating", "Navigated"],
  goBack: ["Going back", "Went back"],
  goForward: ["Going forward", "Went forward"],
  reloadPage: ["Reloading page", "Page reloaded"],
  clickElement: ["Clicking element", "Clicked"],
  typeText: ["Typing text", "Typed"],
  pressKey: ["Pressing key", "Key pressed"],
  scrollPage: ["Scrolling the page", "Scrolled"],
  hoverElement: ["Hovering over element", "Hovered"],
  selectOption: ["Selecting option", "Selected"],
  fillForm: ["Filling form", "Form filled"],
  getPageStructure: ["Scanning page structure", "Page scanned"],
  getElementInfo: ["Inspecting element", "Element inspected"],
  getPageLinks: ["Collecting page links", "Links collected"],
  waitForElement: ["Waiting for element", "Element found"],
  extractData: ["Extracting data", "Data extracted"],
  executeScript: ["Running script", "Script executed"],
  openTab: ["Opening new tab", "Tab opened"],
};

function getToolLabel(toolName: string, state: "running" | "done"): string {
  const labels = TOOL_LABELS[toolName];
  if (!labels) return state === "running" ? "Running" : "Done";
  return state === "running" ? labels[0] : labels[1];
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
  const isRunning = !isComplete && part.type === "tool-call";
  const isError = part.type === "tool-error";

  if (isRunning) {
    return (
      <div className="tool-inline running">
        <span className="streaming-cursor" />
        <span>{getToolLabel(part.toolName, "running")}</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="tool-inline error">
        <span>{part.toolName} failed</span>
      </div>
    );
  }

  if (isComplete && part.type === "tool-result") {
    return (
      <div className="tool-inline done">
        <span>{getToolLabel(part.toolName, "done")}</span>
      </div>
    );
  }

  return null;
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

  function isReasoningOpen(index: number): boolean {
    const isLast = index === message.parts.length - 1;
    const streaming = isActivelyStreaming && isLast;
    const stale =
      isActivelyStreaming && !isLast && !userToggled.has(index);
    return streaming || (!collapsedReasoning.has(index) && !stale);
  }

  function toggleReasoning(index: number) {
    const currentlyOpen = isReasoningOpen(index);
    setUserToggled((prev) => new Set([...prev, index]));
    setCollapsedReasoning((prev) => {
      const next = new Set(prev);
      if (currentlyOpen) next.add(index);
      else next.delete(index);
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
            const isOpen = isReasoningOpen(index);
            return (
              <div key={index}>
                <Button
                  variant="ghost"
                  size="xs"
                  className={`reasoning-toggle ${isOpen ? "open" : ""}`}
                  onClick={() => toggleReasoning(index)}
                  type="button"
                >
                  <Brain />
                  <span>{isStreaming ? "Thinking..." : "Thinking"}</span>
                  <ChevronRight className="chevron" />
                </Button>
                <div className={`reasoning-wrapper ${isOpen ? "visible" : ""}`}>
                  <div className="reasoning-inner">
                    <div className="reasoning-content">
                      {part.content}
                      {isStreaming && <span className="streaming-cursor" />}
                    </div>
                  </div>
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
              <ToolCard key={part.toolCallId} part={part} isComplete />
            );

          case "image":
            return (
              <div key={index} className="message-image">
                <img src={part.image} alt="User uploaded" />
              </div>
            );
        }
      })}

      {hasContent && !isActivelyStreaming && (
        <Button
          variant="ghost"
          size="icon-xs"
          className="copy-btn"
          onClick={handleCopy}
          type="button"
          aria-label="Copy message"
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      )}
    </div>
  );
}
