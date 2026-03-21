import { useState, useRef, useEffect } from "react";
import { Send, ChevronDown } from "lucide-react";
import { OPENROUTER_MODELS } from "@/lib/models";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  model: string;
  onModelChange: (model: string) => void;
}

export function ChatInput({
  onSend,
  disabled,
  model,
  onModelChange,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed && !disabled) {
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
    if (textareaRef.current && !disabled) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  return (
    <div className="input-area">
      <div className="input-wrapper">
        <div className="textarea-row">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            rows={1}
            disabled={disabled}
          />
          <button
            className="send-btn"
            onClick={handleSubmit}
            disabled={disabled || !value.trim()}
            type="button"
          >
            <Send />
          </button>
        </div>
        <div className="model-row">
          <div className="model-selector">
            <ChevronDown />
            <select
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
              disabled={disabled}
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
