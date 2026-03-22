import { useState, useRef, useEffect } from "react";
import { Send, ChevronDown, Pause, ImagePlus, X } from "lucide-react";
import { OPENROUTER_MODELS, getModelCapabilities } from "@/lib/models";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  onSend: (
    message: string,
    images?: { dataUrl: string; mediaType: string }[],
  ) => void;
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
  const [images, setImages] = useState<
    { dataUrl: string; mediaType: string; name: string }[]
  >([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { vision: modelSupportsVision } = getModelCapabilities(model);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if ((trimmed || images.length > 0) && !isStreaming) {
      onSend(trimmed, images.length > 0 ? images : undefined);
      setValue("");
      setImages([]);
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

  const addImageFile = (file: File, name: string) => {
    const reader = new FileReader();
    reader.onload = () => {
      setImages((prev) => [
        ...prev,
        { dataUrl: reader.result as string, mediaType: file.type, name },
      ]);
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    for (const file of Array.from(e.target.files ?? [])) {
      addImageFile(file, file.name);
    }
    e.target.value = "";
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    for (const item of Array.from(e.clipboardData.items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) addImageFile(file, "Pasted image");
      }
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (textareaRef.current && !isStreaming) {
      textareaRef.current.focus();
    }
  }, [isStreaming]);

  return (
    <div className="input-area">
      <div className="input-wrapper">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Ask a question..."
          rows={1}
          className="border-0 resize-none focus-visible:ring-0 w-full"
        />
        <div className="textarea-row">
          <button
            className="upload-btn"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <ImagePlus size={16} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={handleFileSelect}
          />
          <button
            className="upload-btn"
            onClick={isStreaming ? onAbort : handleSubmit}
            disabled={!isStreaming && !value.trim() && images.length === 0}
            type="button"
          >
            {isStreaming ? <Pause size={16} /> : <Send size={16} />}
          </button>
        </div>
        {images.length > 0 && (
          <div className="image-preview-row">
            {images.map((img, i) => (
              <div key={i} className="image-preview">
                <img src={img.dataUrl} alt={img.name} />
                <button
                  className="image-remove"
                  onClick={() => removeImage(i)}
                  type="button"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
        {images.length > 0 && !modelSupportsVision && (
          <p className="vision-warning">
            Selected model doesn&apos;t support images
          </p>
        )}
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
