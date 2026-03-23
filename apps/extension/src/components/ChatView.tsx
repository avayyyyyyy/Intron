import { useEffect, useRef, useState } from "react";
import { Plus, Settings as SettingsIcon, AlertCircle, History, Trash2, MessageSquare } from "lucide-react";
import { useChatStore } from "@/store/chat";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { useStreamingChat } from "@/hooks/useStreamingChat";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatRelativeTime } from "@/lib/utils";

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

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  // Auto-scroll during streaming — intentionally runs every render
  useEffect(() => {
    if (isStreaming && isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    }
  });

  return (
    <div className="sidepanel">
      <header className="header">
        <div className="header-brand">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect width="18" height="18" rx="4" fill="#111"/>
            <rect x="2.5" y="5.5" width="4.5" height="1.5" rx="0.75" fill="#E0E0E0"/>
            <path d="M7 6.25 C8.2 6.25 8.2 11 11.5 11" stroke="#E0E0E0" strokeWidth="1.2" strokeLinecap="round" opacity="0.4"/>
            <rect x="11.5" y="10.25" width="4" height="1.5" rx="0.75" fill="#E0E0E0"/>
            <rect x="2.5" y="12.5" width="13" height="1.5" rx="0.75" fill="#888" opacity="0.45"/>
          </svg>
          <span>Intron</span>
        </div>
        <div className="header-controls">
          <ConversationMenu onNewChat={onNewChat} />
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

function EmptyState({ onSend }: { onSend: (msg: string, images?: { dataUrl: string; mediaType: string }[]) => void }) {
  const { conversations, loadConversation } = useChatStore();
  const recentChats = conversations.slice(0, 4);

  return (
    <div className="home">
      <div className="home-hero">
        <div className="home-eye" />
        <p className="home-tagline">What can I help with?</p>
      </div>

      {recentChats.length > 0 && (
        <div className="home-recent">
          <p className="home-section-label">Recent</p>
          {recentChats.map((c) => (
            <Button
              key={c.id}
              variant="ghost"
              className="home-recent-item"
              onClick={() => loadConversation(c.id)}
              type="button"
            >
              <MessageSquare size={12} />
              <span className="home-recent-title">{c.title}</span>
              <span className="home-recent-time">{formatRelativeTime(c.updatedAt)}</span>
            </Button>
          ))}
        </div>
      )}

      <div className="home-suggestions">
        {["Summarize this page", "Help me write", "Find info", "Fill a form"].map((s) => (
          <Button
            key={s}
            variant="outline"
            size="xs"
            className="home-chip-inline"
            onClick={() => onSend(s)}
            type="button"
          >
            {s}
          </Button>
        ))}
      </div>
    </div>
  );
}

function ConversationMenu({ onNewChat }: { onNewChat: () => void }) {
  const [open, setOpen] = useState(false);
  const { conversations, activeConversationId, loadConversation, deleteConversation } =
    useChatStore();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div className="conv-menu" ref={menuRef}>
      <Button variant="ghost" size="icon" onClick={onNewChat} title="New chat">
        <Plus />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        title="Chat history"
      >
        <History />
      </Button>

      {open && (
        <div className="conv-dropdown">
          <div className="conv-dropdown-header">Recent chats</div>
          {conversations.length === 0 ? (
            <div className="conv-empty-msg">No previous chats</div>
          ) : (
            <div className="conv-list">
              {conversations.map((c) => (
                <div
                  key={c.id}
                  className={`conv-item ${c.id === activeConversationId ? "active" : ""}`}
                >
                  <button
                    className="conv-item-btn"
                    onClick={() => {
                      loadConversation(c.id);
                      setOpen(false);
                    }}
                    type="button"
                  >
                    <MessageSquare size={12} />
                    <span className="conv-title">{c.title}</span>
                    <span className="conv-date">{formatRelativeTime(c.updatedAt)}</span>
                  </button>
                  <button
                    className="conv-delete"
                    onClick={() => deleteConversation(c.id)}
                    type="button"
                    title="Delete chat"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
