import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { getSettings, saveSettings, type Settings } from "@/lib/settings";

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
      <button className="settings-back-btn" onClick={onBack} type="button">
        <ArrowLeft />
        <span>Back to chat</span>
      </button>

      <div className="settings-section">
        <label className="settings-label" htmlFor="api-key">
          OpenRouter API Key
        </label>
        <input
          id="api-key"
          type="password"
          className="settings-input"
          value={settings.apiKey}
          onChange={(e) =>
            setSettings((s) => ({ ...s, apiKey: e.target.value }))
          }
          placeholder="sk-or-..."
        />
      </div>

      <button
        className="settings-save-btn"
        onClick={handleSave}
        disabled={isSaving}
        type="button"
      >
        {isSaving ? "Saving..." : "Save Settings"}
      </button>
    </div>
  );
}
