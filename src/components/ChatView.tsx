import { useEffect, useRef } from "react";
import { Plus, Settings as SettingsIcon } from "lucide-react";
import { useChatStore } from "@/store/chat";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { useStreamingChat } from "@/hooks/useStreamingChat";

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
  const { sendMessage } = useStreamingChat({ apiKey, model });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  return (
    <div className="sidepanel">
      <header className="header">
        <div className="header-brand">
          <span>Pavo</span>
        </div>
        <div className="header-controls">
          <button
            className="icon-btn"
            onClick={onNewChat}
            title="New chat"
            type="button"
          >
            <Plus />
          </button>
          <button
            className="icon-btn"
            onClick={onSettings}
            title="Settings"
            type="button"
          >
            <SettingsIcon />
          </button>
        </div>
      </header>

      <div className="chat-body">
        {error && (
          <div className="error-banner">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="message-list">
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
          disabled={isStreaming}
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
          <button
            key={s}
            className="suggestion-chip"
            onClick={() => onSend(s)}
            type="button"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
