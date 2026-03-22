import { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { ChatView } from "@/components/ChatView";
import { SettingsView } from "@/components/SettingsView";
import { useChatStore } from "@/store/chat";
import { getSettings, saveSettings, type Settings } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setSourceTabId } from "@/lib/messaging";

type View = "chat" | "settings";

export default function App() {
  const [view, setView] = useState<View>("chat");
  const [settings, setSettings] = useState<Settings | null>(null);
  const { clearMessages } = useChatStore();

  useEffect(() => {
    getSettings().then(setSettings);
    chrome.tabs.getCurrent().then((tab) => {
      if (tab && tab.id) setSourceTabId(tab.id);
    });
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
        <Onboarding
          onComplete={(apiKey) => {
            const updated = { ...settings, apiKey };
            setSettings(updated);
            saveSettings(updated);
          }}
        />
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

function Onboarding({ onComplete }: { onComplete: (apiKey: string) => void }) {
  const [key, setKey] = useState("");

  return (
    <div className="onboarding">
      <div className="onboarding-hero">
        <div className="intron-mark large">
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
            <rect width="52" height="52" rx="11" fill="#111" />
            <rect x="8" y="17" width="12" height="3" rx="1.5" fill="#E0E0E0" />
            <path
              d="M20 18.5 C24 18.5 24 31 32 31"
              stroke="#E0E0E0"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.4"
            />
            <rect
              x="32"
              y="29.5"
              width="12"
              height="3"
              rx="1.5"
              fill="#E0E0E0"
            />
            <rect
              x="8"
              y="34"
              width="36"
              height="3"
              rx="1.5"
              fill="#888"
              opacity="0.45"
            />
          </svg>
        </div>
        <h1 className="onboarding-title">Intron</h1>
        <p className="onboarding-sub">Browser automation agent</p>
      </div>

      <div className="onboarding-card">
        <label className="onboarding-label" htmlFor="onboard-key">
          OpenRouter API Key
        </label>
        <Input
          id="onboard-key"
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="sk-or-..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && key.trim()) onComplete(key.trim());
          }}
        />
        <Button
          className="w-full mt-3"
          disabled={!key.trim()}
          onClick={() => onComplete(key.trim())}
        >
          Get Started
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      <a
        href="https://openrouter.ai/keys"
        target="_blank"
        rel="noopener noreferrer"
        className="onboarding-link"
      >
        Get a key at openrouter.ai →
      </a>
    </div>
  );
}
