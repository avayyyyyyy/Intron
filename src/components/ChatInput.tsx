import { useState, useRef, useEffect } from "react";
import { Send, ChevronDown, Pause } from "lucide-react";
import { OPENROUTER_MODELS } from "@/lib/models";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  onSend: (message: string) => void;
  isStreaming: boolean;
  onAbort: () => void;
  model: string;
  onModelChange: (model: string) => void;
}

export function ChatInput({
  onSend,
  isStreaming,
  onAbort,
  model,
  onModelChange,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed && !isStreaming) {
      onSend(trimmed);
      setValue("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        120,
      )}px`;
    }
  };

  useEffect(() => {
    if (textareaRef.current && !isStreaming) {
      textareaRef.current.focus();
    }
  }, [isStreaming]);

  return (
    <div className="input-area">
      <div className="input-wrapper">
        <div className="textarea-row">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            rows={1}
            disabled={isStreaming}
            className="border-0 resize-none focus-visible:ring-0"
          />
          <Button
            variant={isStreaming ? "secondary" : "default"}
            size="icon"
            className="hover:cursor-pointer"
            onClick={isStreaming ? onAbort : handleSubmit}
            disabled={!isStreaming && !value.trim()}
          >
            {isStreaming ? <Pause /> : <Send />}
          </Button>
        </div>
        <div className="model-row">
          <div className="model-selector">
            <ChevronDown />
            <select
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
              disabled={isStreaming}
            >
              {OPENROUTER_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
