import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { getSettings, saveSettings, type Settings } from "@/lib/settings";
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
    </div>
  );
}
