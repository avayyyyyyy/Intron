import { useState, useEffect } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { getSettings, saveSettings, type Settings } from "@/lib/settings";
import { useChatStore } from "@/store/chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SettingsViewProps {
  onBack: () => void;
  onSaved: () => void;
}

export function SettingsView({ onBack, onSaved }: SettingsViewProps) {
  const [settings, setSettings] = useState<Settings>({
    apiKey: "",
    model: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const { clearMessages, messages } = useChatStore();

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    await saveSettings(settings);
    setIsSaving(false);
    onSaved();
  };

  return (
    <div className="settings-view">
      <Button variant="outline" size="sm" onClick={onBack}>
        <ArrowLeft />
        <span>Back to chat</span>
      </Button>

      <div className="settings-section">
        <label className="settings-label" htmlFor="api-key">
          OpenRouter API Key
        </label>
        <Input
          id="api-key"
          type="password"
          value={settings.apiKey}
          onChange={(e) =>
            setSettings((s) => ({ ...s, apiKey: e.target.value }))
          }
          placeholder="sk-or-..."
        />
      </div>

      <Button onClick={handleSave} disabled={isSaving}>
        {isSaving ? "Saving..." : "Save Settings"}
      </Button>

      {messages.length > 0 && (
        <div className="mt-6 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">
            {messages.length} message{messages.length !== 1 ? "s" : ""} stored
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (!confirmingClear) {
                setConfirmingClear(true);
                return;
              }
              clearMessages();
              setConfirmingClear(false);
            }}
            onBlur={() => setConfirmingClear(false)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {confirmingClear ? "Click again to confirm" : "Delete All Chats"}
          </Button>
        </div>
      )}
    </div>
  );
}
