import { useState, useEffect } from "react";
import { Bot } from "lucide-react";
import { ChatView } from "@/components/ChatView";
import { SettingsView } from "@/components/SettingsView";
import { useChatStore } from "@/store/chat";
import { getSettings, saveSettings, type Settings } from "@/lib/settings";

type View = "chat" | "settings";

export default function App() {
  const [view, setView] = useState<View>("chat");
  const [settings, setSettings] = useState<Settings | null>(null);
  const { clearMessages } = useChatStore();

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const handleNewChat = () => {
    clearMessages();
  };

  const handleModelChange = async (model: string) => {
    if (!settings) return;
    const updated = { ...settings, model };
    setSettings(updated);
    await saveSettings(updated);
  };

  if (!settings) {
    return (
      <div className="sidepanel">
        <div className="empty-state">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (view === "settings") {
    return (
      <div className="sidepanel">
        <SettingsView
          onBack={() => setView("chat")}
          onSaved={() => {
            getSettings().then(setSettings);
            setView("chat");
          }}
        />
      </div>
    );
  }

  if (!settings.apiKey) {
    return (
      <div className="sidepanel">
        <div className="empty-state">
          <Bot />
          <h2>Setup Required</h2>
          <p>Add your OpenRouter API key in Settings to start chatting.</p>
          <button
            className="settings-save-btn"
            onClick={() => setView("settings")}
            type="button"
          >
            Open Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <ChatView
      apiKey={settings.apiKey}
      model={settings.model}
      onModelChange={handleModelChange}
      onSettings={() => setView("settings")}
      onNewChat={handleNewChat}
    />
  );
}
