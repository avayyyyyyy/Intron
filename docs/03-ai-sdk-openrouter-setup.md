# AI SDK & OpenRouter Setup

> Reference doc for the Twitter/computer-use agent Chrome Extension (MV3).
> Stack: React 18 + TypeScript + Bun + Vite + side-panel UI.

---

> **TL;DR**
>
> - OpenRouter supports CORS from browsers — call it directly from the side panel, no server needed
> - Vercel AI SDK (`streamText`, `useChat`, `@ai-sdk/*`) is server-side only — skip it entirely
> - Background service worker has a hard 30-second fetch timeout — do NOT proxy streaming through `background.js`
> - Architecture: Sidepanel → OpenRouter directly via `fetch` + native SSE parsing
> - API key: stored in `chrome.storage.sync` via a settings screen — no `.env`, no backend

---

## 1. Why NOT Vercel AI SDK

The obvious first instinct when adding AI to a React project is to reach for Vercel's AI SDK (`ai`, `@ai-sdk/react`, `@openrouter/ai-sdk-provider`). For a Chrome extension, this is the wrong call. Here is why each piece breaks down.

### `streamText`

`streamText` is a Node.js function. It depends on Node.js streams, `process`, and server runtime APIs. It does not run in a browser context or a Chrome extension service worker. Bundling it into a Vite extension build will either fail outright or produce a broken runtime.

### `useChat`

`useChat` is a React hook, which sounds like exactly what we want — but it works by making `fetch` calls to a backend route you own (e.g. `POST /api/chat`). That backend route must speak the Vercel AI stream protocol (a newline-delimited format, not raw SSE). There is no `/api/chat` in a Chrome extension — there is no server at all.

### `@openrouter/ai-sdk-provider`

This package is a config adapter that wraps OpenRouter's base URL and auth headers into an object that `streamText` can consume. It has no standalone utility. Without `streamText` it is dead code.

### Decision: use native `fetch`

OpenRouter's API is OpenAI-compatible and natively speaks SSE (`text/event-stream`). Every modern browser (and every Chrome extension context) has `fetch` and `ReadableStream`. The implementation is ~60 lines of TypeScript. Zero extra dependencies. Smaller bundle. Full control.

| Approach | Works in extension | Bundle cost | Complexity |
|---|---|---|---|
| Vercel AI SDK (`streamText` + `useChat`) | No | ~45 KB | High (needs backend) |
| `@ai-sdk/react` + custom backend | No | ~30 KB | High |
| Native `fetch` + SSE parsing | Yes | 0 KB | Low |

---

## 2. OpenRouter API Reference

### Endpoint

```
POST https://openrouter.ai/api/v1/chat/completions
```

### Request headers

| Header | Required | Value |
|---|---|---|
| `Authorization` | Yes | `Bearer <your-api-key>` |
| `Content-Type` | Yes | `application/json` |
| `HTTP-Referer` | No | Your extension's Chrome Web Store URL or repo URL |
| `X-Title` | No | Human-readable app name shown in OpenRouter dashboard |

### Request body

OpenRouter uses the OpenAI chat completions schema verbatim:

```json
{
  "model": "google/gemini-2.0-flash-001",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello!" }
  ],
  "stream": true
}
```

### Streaming response format

With `stream: true`, the response is `Content-Type: text/event-stream`. Each chunk is a standard SSE line:

```
data: {"id":"...","choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"...","choices":[{"delta":{"content":" there"},"finish_reason":null}]}

data: [DONE]
```

- Filter lines that start with `data: `
- Strip the `data: ` prefix and parse the remainder as JSON
- Extract `choices[0].delta.content` — this is the token to append
- When you see `data: [DONE]`, the stream is complete

### CORS

OpenRouter explicitly supports CORS from browser origins. The `Access-Control-Allow-Origin: *` header is set on all API responses. You can call it directly from a side-panel page or any extension page with no proxy required.

The project's `manifest.json` already has `"host_permissions": ["<all_urls>"]`, which covers `https://openrouter.ai/*`. No manifest changes are needed.

---

## 3. Architecture: Sidepanel-direct vs. Background.js proxy

Two plausible approaches exist for where to run the OpenRouter fetch. The background approach looks appealing because the service worker "always runs" — but it has a critical limitation.

### The 30-second service worker timeout

Chrome MV3 service workers terminate after 30 seconds of inactivity and are constrained to 30-second fetch responses by the browser. A streaming LLM response can easily run 30–120 seconds for a long reply. The service worker will be killed mid-stream, leaving the UI hanging.

### `ReadableStream` cannot cross `sendMessage`

Even if you worked around the timeout, Chrome's `chrome.runtime.sendMessage` / `chrome.runtime.onMessage` messaging API only supports serialisable (JSON-compatible) values. A `ReadableStream` is not serialisable. You cannot pipe a stream from `background.js` to the side panel via the message bus.

The only way to stream from background to sidepanel would be a port-based long-lived connection with manual chunking — which adds significant complexity for no benefit.

### Tradeoff table

| | Sidepanel direct (chosen) | Background.js proxy |
|---|---|---|
| 30-second timeout | No timeout — side panel pages have no fetch timeout limit | 30-second SW timeout kills any long stream |
| `ReadableStream` support | Native `response.body.getReader()` just works | Cannot pass a stream via `sendMessage` |
| Implementation complexity | ~60 lines, single file | Requires port-based messaging, manual chunking, reconnect logic |
| API key exposure | Key lives in extension settings, accessed via `chrome.storage` | Same — no difference |
| Works offline? | No (same as proxy) | No |
| CORS required | Yes — OpenRouter supports it | Not required (SW can bypass CORS) — but CORS works anyway |

**Decision: call OpenRouter directly from the side-panel React component using a custom hook.**

---

## 4. API Key Storage

### Where the key lives

API keys are stored in `chrome.storage.sync` via a settings screen the user fills in. There is no `.env` file, no hardcoded key, and no backend proxy to hold the key server-side.

`chrome.storage.sync` syncs the key across the user's Chrome profile (multiple devices). If cross-device sync is undesirable, use `chrome.storage.local` instead — the API is identical.

### Why not `.env`

A `.env` file embedded in a Chrome extension is public. Anyone can unzip the `.crx` and read it. There is no mechanism to hide a secret in a browser extension build artifact. Asking the user to supply their own key is the correct model for this type of developer tool.

### Security posture

Chrome extensions expose all key material to the user who installed them. This is unavoidable — the extension runs in the user's browser, under their profile, and they can inspect `chrome.storage` via DevTools at any time. Document this clearly in any public README: **this extension stores your OpenRouter API key locally in your browser. Never share your extension profile or storage with untrusted parties.**

For a personal developer tool (the intended use case), this is an acceptable tradeoff. For a commercially distributed extension intended for non-technical end users, consider a backend proxy that holds a shared key and authenticates extension installs instead.

### Storage schema

```ts
// src/lib/settings.ts

interface ExtensionSettings {
  apiKey: string;
  model: string;
}

const SETTINGS_KEY = "extension_settings";

const DEFAULT_SETTINGS: ExtensionSettings = {
  apiKey: "",
  model: "google/gemini-2.0-flash-001",
};

export async function getSettings(): Promise<ExtensionSettings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(SETTINGS_KEY, (result) => {
      const stored = result[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined;
      resolve({ ...DEFAULT_SETTINGS, ...stored });
    });
  });
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [SETTINGS_KEY]: settings }, () => resolve());
  });
}
```

---

## 5. Full Implementation

### TypeScript types

```ts
// src/types/chat.ts

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface ChatState {
  messages: Message[];
  isStreaming: boolean;
  error: string | null;
}
```

### Available models

Use this list to populate a model picker in the settings UI. These are the recommended models as of early 2026 — check OpenRouter's model list for pricing and context window sizes.

```ts
// src/lib/models.ts

export interface ModelOption {
  id: string;
  name: string;
  desc: string;
}

export const OPENROUTER_MODELS: ModelOption[] = [
  {
    id: "google/gemini-2.0-flash-001",
    name: "Gemini 2.0 Flash",
    desc: "Fastest, cheapest",
  },
  {
    id: "anthropic/claude-3.5-haiku",
    name: "Claude 3.5 Haiku",
    desc: "Strong reasoning",
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    desc: "OpenAI baseline",
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct",
    name: "Llama 3.3 70B",
    desc: "Open source",
  },
];
```

### `useStreamingChat` custom hook

This hook encapsulates all streaming logic. It owns the message list, the streaming state, error handling, and an `AbortController` for cancellation.

```ts
// src/hooks/useStreamingChat.ts

import { useState, useRef, useCallback } from "react";
import { getSettings } from "@/lib/settings";
import type { Message, ChatState } from "@/types/chat";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useStreamingChat() {
  const [state, setState] = useState<ChatState>({
    messages: [],
    isStreaming: false,
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (state.isStreaming) return;

    // Build the user message and optimistically add it to the list
    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content,
    };

    // Placeholder for the assistant reply — we stream into this
    const assistantMessage: Message = {
      id: generateId(),
      role: "assistant",
      content: "",
    };

    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMessage, assistantMessage],
      isStreaming: true,
      error: null,
    }));

    // Set up cancellation
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const settings = await getSettings();

      if (!settings.apiKey) {
        throw new Error("NO_API_KEY");
      }

      // Build the message history to send (all messages except the empty placeholder)
      const history = [...state.messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/your-org/exten-agent",
          "X-Title": "Exten Agent",
        },
        body: JSON.stringify({
          model: settings.model,
          messages: history,
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(`HTTP_${response.status}:${errorBody}`);
      }

      if (!response.body) {
        throw new Error("EMPTY_BODY");
      }

      // Read the SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        // Decode the chunk — SSE may split across multiple reads
        const chunk = decoder.decode(value, { stream: true });

        // Split on newlines and process each SSE line
        const lines = chunk.split("\n");

        for (const line of lines) {
          const trimmed = line.trim();

          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const payload = trimmed.slice("data: ".length);

          if (payload === "[DONE]") {
            // Stream finished — break out of the read loop
            await reader.cancel();
            break;
          }

          let parsed: { choices?: { delta?: { content?: string } }[] };

          try {
            parsed = JSON.parse(payload);
          } catch {
            // Malformed chunk — skip
            continue;
          }

          const delta = parsed.choices?.[0]?.delta?.content;

          if (delta) {
            accumulated += delta;

            // Update the assistant message in state with the accumulated content
            setState((prev) => {
              const messages = [...prev.messages];
              const lastIndex = messages.length - 1;
              if (lastIndex >= 0 && messages[lastIndex].role === "assistant") {
                messages[lastIndex] = {
                  ...messages[lastIndex],
                  content: accumulated,
                };
              }
              return { ...prev, messages };
            });
          }
        }
      }

      setState((prev) => ({ ...prev, isStreaming: false }));
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // User cancelled — not an error condition
        setState((prev) => ({ ...prev, isStreaming: false }));
        return;
      }

      const message = err instanceof Error ? err.message : "Unknown error";
      let friendlyError = "Something went wrong. Please try again.";

      if (message === "NO_API_KEY") {
        friendlyError = "No API key set. Open settings and add your OpenRouter key.";
      } else if (message.startsWith("HTTP_401")) {
        friendlyError = "Invalid API key. Check your key in settings.";
      } else if (message.startsWith("HTTP_429")) {
        friendlyError = "Rate limited by OpenRouter. Wait a moment and try again.";
      } else if (message.startsWith("HTTP_404")) {
        friendlyError = "Model not available. Try switching to a different model in settings.";
      } else if (message.startsWith("HTTP_5")) {
        friendlyError = "OpenRouter server error. Try again shortly.";
      } else if (message === "EMPTY_BODY") {
        friendlyError = "Empty response from OpenRouter. Check your API key and model.";
      } else if (!navigator.onLine) {
        friendlyError = "No internet connection.";
      }

      setState((prev) => ({
        ...prev,
        isStreaming: false,
        error: friendlyError,
      }));
    } finally {
      abortRef.current = null;
    }
  }, [state.messages, state.isStreaming]);

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearMessages = useCallback(() => {
    setState({ messages: [], isStreaming: false, error: null });
  }, []);

  const dismissError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    messages: state.messages,
    isStreaming: state.isStreaming,
    error: state.error,
    sendMessage,
    cancelStream,
    clearMessages,
    dismissError,
  };
}
```

### Example usage in a component

```tsx
// src/components/chat/ChatPanel.tsx

import { useStreamingChat } from "@/hooks/useStreamingChat";
import { useState } from "react";

export function ChatPanel() {
  const { messages, isStreaming, error, sendMessage, cancelStream, dismissError } =
    useStreamingChat();
  const [input, setInput] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput("");
    await sendMessage(trimmed);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={msg.role === "user" ? "text-right" : "text-left"}
          >
            <span className="inline-block rounded-lg px-3 py-2 text-sm bg-muted max-w-[85%]">
              {msg.content || (msg.role === "assistant" && isStreaming ? "…" : "")}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="px-4 py-2 text-sm text-destructive bg-destructive/10 flex justify-between">
          <span>{error}</span>
          <button onClick={dismissError} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-3 border-t flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message…"
          disabled={isStreaming}
          className="flex-1 rounded-md border px-3 py-2 text-sm"
        />
        {isStreaming ? (
          <button type="button" onClick={cancelStream} className="px-3 py-2 text-sm">
            Stop
          </button>
        ) : (
          <button type="submit" disabled={!input.trim()} className="px-3 py-2 text-sm">
            Send
          </button>
        )}
      </form>
    </div>
  );
}
```

### Settings screen

```tsx
// src/components/settings/SettingsPanel.tsx

import { useEffect, useState } from "react";
import { getSettings, saveSettings } from "@/lib/settings";
import { OPENROUTER_MODELS } from "@/lib/models";

export function SettingsPanel() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("google/gemini-2.0-flash-001");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      setApiKey(s.apiKey);
      setModel(s.model);
    });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await saveSettings({ apiKey, model });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={handleSave} className="p-4 space-y-4">
      <div>
        <label className="text-sm font-medium">OpenRouter API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-or-..."
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm font-mono"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Get a key at{" "}
          <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="underline">
            openrouter.ai/keys
          </a>
          . Your key is stored locally in Chrome and never leaves your browser.
        </p>
      </div>

      <div>
        <label className="text-sm font-medium">Model</label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
        >
          {OPENROUTER_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} — {m.desc}
            </option>
          ))}
        </select>
      </div>

      <button type="submit" className="w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
        {saved ? "Saved!" : "Save settings"}
      </button>
    </form>
  );
}
```

---

## 6. Package installs needed

```bash
# No @ai-sdk packages needed at all.
# The entire AI integration uses native fetch — zero extra dependencies.

# Confirm your current dependencies are sufficient:
bun install
```

This is intentional. The native `fetch` + `ReadableStream` approach produces the smallest possible bundle for the AI layer. There are no transitive dependencies to audit, no version conflicts, and no Node.js polyfills required.

The only AI-related packages you might optionally add are for the UI layer (markdown rendering for assistant responses):

```bash
# Optional — only if rendering markdown in assistant messages
bun add react-markdown remark-gfm
```

See `docs/02-libraries-and-dx.md` §6 for the full markdown + syntax highlighting setup.

---

## 7. Error Handling Patterns

The `useStreamingChat` hook maps raw errors to user-friendly messages. This section documents each case and the recommended UX response.

### Network error (offline or DNS failure)

**Cause:** The `fetch` call throws a `TypeError` before getting a response. `navigator.onLine` is `false`.

**Detection:** `err instanceof TypeError` + `!navigator.onLine`

**UX:** Show "No internet connection." inline above the input. Do not navigate to settings.

### 401 — Invalid API key

**Cause:** The API key is wrong, expired, or has been revoked.

**Detection:** `response.status === 401`

**UX:** Show "Invalid API key. Check your key in settings." with a link/button that opens the settings panel. This is the most common error for new users.

### 429 — Rate limit

**Cause:** The user has exceeded their OpenRouter rate limit for the chosen model.

**Detection:** `response.status === 429`

**UX:** Show "Rate limited by OpenRouter. Wait a moment and try again." The response body sometimes includes a `retry-after` header — parse it and show a countdown if present.

### 404 — Model not available

**Cause:** The model ID stored in settings is no longer available on OpenRouter (deprecated, renamed, or region-locked).

**Detection:** `response.status === 404`

**UX:** Show "Model not available. Try switching to a different model in settings." with a link to the settings panel.

### 5xx — OpenRouter server error

**Cause:** OpenRouter infrastructure issue.

**Detection:** `response.status >= 500`

**UX:** Show "OpenRouter server error. Try again shortly." Include a retry button that re-sends the last message.

### Stream interrupted mid-response

**Cause:** Network drop, Chrome suspending the side panel, or OpenRouter closing the connection before `[DONE]`.

**Detection:** `reader.read()` returns `done: true` before a `[DONE]` SSE event is received. The accumulated content will be non-empty but truncated.

**UX:** The partial response is already displayed. Append a visual indicator like `[response cut off]` in muted text, and show a "retry" button. Do not discard the partial message — partial context is useful.

### User cancellation

**Cause:** User clicks "Stop" while streaming.

**Detection:** `err.name === "AbortError"` (thrown when `AbortController.abort()` is called).

**UX:** Not an error — stop the spinner silently. Keep the partial response visible. The input field becomes active again.

### Error handling summary table

| Error | HTTP status | Detection | UX action |
|---|---|---|---|
| No API key set | — | `settings.apiKey === ""` | Prompt to open settings |
| Invalid API key | 401 | `response.status === 401` | Link to settings |
| Rate limited | 429 | `response.status === 429` | Retry message + wait |
| Model unavailable | 404 | `response.status === 404` | Link to model picker in settings |
| Server error | 5xx | `response.status >= 500` | Retry button |
| Network offline | — | `!navigator.onLine` | "No internet" message |
| Stream interrupted | — | `done` without `[DONE]` | Show partial + retry |
| User cancelled | — | `AbortError` | Silent, keep partial |

---

## Decision log

| Decision | Rejected alternative | Reason |
|---|---|---|
| Native `fetch` + SSE parsing | Vercel AI SDK (`streamText`, `useChat`) | AI SDK is server-side only; no backend in a Chrome extension |
| Sidepanel direct fetch | Background.js proxy | 30-second SW timeout kills long streams; `ReadableStream` not serialisable via `sendMessage` |
| `chrome.storage.sync` for API key | `.env` file | `.env` is visible in built extension artifact; user-supplied key is the correct model |
| `chrome.storage.sync` over `local` | `chrome.storage.local` | Sync persists key across user's Chrome devices — better UX for developer tools |
| Custom `useStreamingChat` hook | Third-party streaming lib | Zero dependencies, full control over SSE parsing and error handling |
| No `@openrouter/ai-sdk-provider` | Using the provider package | It is a `streamText` config wrapper only — useless without the rest of the AI SDK |
| `AbortController` for cancellation | `reader.cancel()` directly | `AbortController` aborts the entire fetch; cleaner than closing only the reader mid-stream |
