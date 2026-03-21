import { OPENROUTER_MODELS } from "./models";

export interface Settings {
  apiKey: string;
  model: string;
}

const STORAGE_KEY = "agent_settings";

export async function getSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(STORAGE_KEY, (result) => {
      const defaultSettings: Settings = {
        apiKey: "",
        model: OPENROUTER_MODELS[0].id,
      };
      if (result[STORAGE_KEY]) {
        resolve({ ...defaultSettings, ...result[STORAGE_KEY] });
      } else {
        resolve(defaultSettings);
      }
    });
  });
}

export async function saveSettings(settings: Settings): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [STORAGE_KEY]: settings }, resolve);
  });
}
