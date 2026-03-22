import { useEffect, useRef } from "react";
import { Plus, Settings as SettingsIcon, AlertCircle } from "lucide-react";
import { useChatStore } from "@/store/chat";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { useStreamingChat } from "@/hooks/useStreamingChat";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ChatViewProps {
  apiKey: string;
  model: string;
  onModelChange: (model: string) => void;
  onSettings: () => void;
  onNewChat: () => void;
}

export function ChatView({
  apiKey,
  model,
  onModelChange,
  onSettings,
  onNewChat,
}: ChatViewProps) {
  const { messages, isStreaming, error } = useChatStore();
  const { sendMessage, abort } = useStreamingChat({ apiKey, model });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Track if user is near bottom (within 150px)
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = list;
      isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 150;
    };
    list.addEventListener("scroll", handleScroll, { passive: true });
    return () => list.removeEventListener("scroll", handleScroll);
  }, []);

  // Scroll on new message
  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  // Auto-scroll during streaming if user is near bottom
  useEffect(() => {
    if (isStreaming && isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    }
  });

  return (
    <div className="sidepanel">
      <header className="header">
        <div className="header-brand">
          <span>Pavo</span>
        </div>
        <div className="header-controls">
          <Button variant="ghost" size="icon" onClick={onNewChat} title="New chat">
            <Plus />
          </Button>
          <Button variant="ghost" size="icon" onClick={onSettings} title="Settings">
            <SettingsIcon />
          </Button>
        </div>
      </header>

      <div className="chat-body">
        {error && (
          <Alert variant="destructive" className="m-0 rounded-none border-x-0 border-t-0">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="message-list" ref={listRef}>
          {messages.length === 0 ? (
            <EmptyState onSend={sendMessage} />
          ) : (
            <>
              {messages.map((message, index) => {
                const isLast = index === messages.length - 1;
                const isActive =
                  isStreaming && isLast && message.role === "assistant";
                return (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    isActivelyStreaming={isActive}
                  />
                );
              })}
              {isStreaming && !messages[messages.length - 1]?.parts.length && (
                <StreamingIndicator />
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        <ChatInput
          onSend={sendMessage}
          isStreaming={isStreaming}
          onAbort={abort}
          model={model}
          onModelChange={onModelChange}
        />
      </div>
    </div>
  );
}

function StreamingIndicator() {
  return (
    <div className="message assistant">
      <div className="message-content">
        <span className="streaming-cursor" />
      </div>
    </div>
  );
}

function EmptyState({ onSend }: { onSend: (msg: string) => void }) {
  const suggestions = ["Summarize this page", "Help me write something"];
  return (
    <div className="empty-state">
      <p className="empty-label">What would you like to explore?</p>
      <div className="suggestion-chips">
        {suggestions.map((s) => (
          <Button
            key={s}
            variant="outline"
            className="suggestion-chip justify-start h-auto py-2 px-3"
            onClick={() => onSend(s)}
          >
            {s}
          </Button>
        ))}
      </div>
    </div>
  );
}
