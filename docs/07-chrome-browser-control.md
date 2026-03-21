---

# Chrome Browser Control APIs for Pavo

## Overview

Chrome extensions have three categories of browser control APIs relevant to an AI agent:

| Category | What it does | Key API |
|----------|-------------|---------|
| **Tab Capture (Screenshots)** | Get a visual snapshot of the current tab as a base64 image | `chrome.tabs.captureVisibleTab` |
| **Content Extraction** | Read the DOM text, title, URL, and metadata from the active tab | `chrome.scripting.executeScript` |
| **Full Browser Automation (CDP)** | Click elements, fill forms, navigate, intercept network — full Chrome DevTools Protocol access | `chrome.debugger` |

Pavo currently implements the first two. The third is available if we need deeper automation later, but requires additional permissions and has UX downsides (the yellow "debugging" bar).

---

## 1. Screenshot Approaches

### 1.1 `chrome.tabs.captureVisibleTab` (RECOMMENDED)

This is the simplest and most reliable way to screenshot the visible viewport.

```ts
chrome.tabs.captureVisibleTab(
  windowId: number | null,
  options?: { format: "png" | "jpeg"; quality?: number },
  callback: (dataUrl: string) => void
): void
```

**Key facts:**

- Returns a **base64-encoded data URL** (`data:image/png;base64,...`)
- Captures only the **visible viewport** — not the full scrollable page
- Requires `<all_urls>` host permission in the manifest (Pavo already has this)
- Rate limited to approximately **2 captures per second** — calling faster returns errors
- Must be called from the **service worker** (background script), not from the sidepanel or content script
- The `windowId` parameter accepts `null` to capture the currently focused window

**The sidepanel `activeTab` bug and workaround:**

In Chrome MV3, the sidepanel does not receive `activeTab` permission the same way a popup does. Calling `captureVisibleTab` directly from sidepanel code fails with a permissions error even when `activeTab` is declared. The workaround is to **always route the call through the background service worker** via message passing. The background script has the necessary permissions context because it listens to tab events and holds the `<all_urls>` host permission.

This is exactly what Pavo does — the sidepanel sends a `CAPTURE_SCREENSHOT` message to the background, which calls `captureVisibleTab` and returns the data URL.

**Limitations:**

- Viewport only — no full-page screenshots
- Cannot capture `chrome://` pages, the new tab page, or the Chrome Web Store
- The PNG is uncompressed and large (typically 1-4 MB for a 1080p viewport). Use `format: "jpeg"` with `quality: 70` to reduce size if sending to an AI model
- Cannot capture specific elements — it is always the full visible viewport

### 1.2 `chrome.debugger` + `Page.captureScreenshot` (Full-page)

For screenshots that extend beyond the visible viewport (full-page scrolling captures), you need the Chrome DevTools Protocol:

```ts
// Attach debugger to the tab
await chrome.debugger.attach({ tabId }, "1.3");

// Capture full page (beyond viewport)
const result = await chrome.debugger.sendCommand(
  { tabId },
  "Page.captureScreenshot",
  {
    format: "png",
    captureBeyondViewport: true,
    fromSurface: true,
  }
);

// result.data is a base64-encoded string (no data URL prefix)
const dataUrl = `data:image/png;base64,${result.data}`;

// Detach when done
await chrome.debugger.detach({ tabId });
```

**Key facts:**

- Requires `"debugger"` permission in the manifest
- **Shows a yellow "Chrome is being controlled by automated test software" bar** at the top of the browser — this is intrusive and cannot be suppressed
- Can capture the **entire scrollable page**, not just the viewport
- Gives access to all CDP screenshot options: clip regions, specific device metrics, etc.
- Much more complex setup than `captureVisibleTab`

**When to use:** Only when you specifically need full-page screenshots or pixel-precise region captures. For an AI agent that just needs to "see" the current screen, `captureVisibleTab` is sufficient.

### 1.3 `chrome.tabCapture` (MediaStream — not for static screenshots)

```ts
chrome.tabCapture.capture(
  { video: true, audio: false },
  (stream: MediaStream) => { ... }
);
```

This API creates a live **MediaStream** of the tab's visual output. It is designed for screen recording, video conferencing, and streaming use cases. It is not practical for static screenshots because:

- You must create a `<video>` element, pipe the stream to it, draw a frame to a `<canvas>`, and export to PNG — a complex pipeline for a single image
- The stream consumes resources until explicitly stopped
- Has its own permission model and user-facing indicators

**Do not use this for AI agent screenshots.** It exists for a different use case entirely.

---

## 2. Page Content Extraction

### 2.1 `chrome.scripting.executeScript` (RECOMMENDED)

This is the standard way to read DOM content from a tab. You inject a function that runs in the page's context and returns structured data.

```ts
chrome.scripting.executeScript({
  target: { tabId },
  func: () => {
    const title = document.title;
    const url = window.location.href;

    // Smart extraction: prefer semantic containers
    const article = document.querySelector("article");
    const main = document.querySelector("main");
    const contentEl = article || main || document.body;

    const text = contentEl?.innerText || "";
    const meta = document
      .querySelector('meta[name="description"]')
      ?.getAttribute("content") || "";

    return { title, url, text, meta };
  },
});
```

**Key facts:**

- Requires `"scripting"` permission and either `"activeTab"` or matching host permissions (Pavo has both)
- The injected function runs in the **page's isolated world** — it can read the DOM but not access extension APIs
- The function must be self-contained — it cannot reference variables from the outer scope (the function is serialized and sent to the content script context)
- Returns results via `results[0].result`
- Cannot execute on `chrome://` pages, `chrome-extension://` pages, or the Chrome Web Store

**Smart extraction pattern (article > main > body):**

The `article || main || document.body` fallback chain is a practical heuristic. Most content-heavy sites wrap their main content in `<article>` or `<main>` elements. Falling back to `document.body` captures everything but also includes navigation, footers, ads, and other noise. For an AI agent, the semantic container approach produces much cleaner text.

**Advanced extraction strategies (not yet implemented):**

- **Readability algorithm** — Mozilla's Readability.js can be injected to extract article content with high fidelity
- **Structured data** — Parse `ld+json` script tags for schema.org metadata
- **Accessibility tree** — Use `document.querySelectorAll('[role]')` to find semantic landmarks

### 2.2 `chrome.debugger` + DOM/Runtime domains (Overkill)

The CDP `DOM.getDocument` and `Runtime.evaluate` commands can also extract page content:

```ts
await chrome.debugger.attach({ tabId }, "1.3");

// Get the full DOM tree
const { root } = await chrome.debugger.sendCommand(
  { tabId },
  "DOM.getDocument",
  { depth: -1, pierce: true }
);

// Or evaluate JS directly
const { result } = await chrome.debugger.sendCommand(
  { tabId },
  "Runtime.evaluate",
  { expression: "document.body.innerText" }
);

await chrome.debugger.detach({ tabId });
```

This is strictly more powerful (you get the full DOM tree as a serialized object, can access shadow DOMs, etc.) but has the same yellow-bar UX problem as debugger-based screenshots. Use `chrome.scripting.executeScript` unless you need CDP-level DOM introspection.

---

## 3. Chrome's New Agentic APIs (2025-2026)

These are emerging APIs that may become relevant to Pavo in the future. See `docs/07b-chrome-agentic-apis.md` for full details.

### 3.1 WebMCP (Canary only, Feb 2026)

A browser-native standard for AI agents to discover and invoke structured actions on websites. Websites declare MCP-compatible tool definitions, and the browser exposes them to extensions/agents. Currently **Canary only** and under W3C standardization with Microsoft. Not usable in production yet.

### 3.2 Chrome Built-in AI (Chrome 138+, Gemini Nano)

On-device AI APIs built directly into Chrome:

| API | What it does | Status |
|-----|-------------|--------|
| **Prompt API** | `ai.languageModel.create()` — run Gemini Nano locally | Chrome 138+ (origin trial) |
| **Summarizer** | `ai.summarizer.create()` — summarize text | Chrome 138+ |
| **Translator** | `ai.translator.create()` — translate text | Chrome 138+ |
| **Language Detector** | `ai.languageDetector.create()` — detect language | Chrome 138+ |

**Hardware requirements:** Requires a device with at least 22 GB storage free for the Gemini Nano model download. Works on desktop Chrome only (not mobile). Performance varies significantly by hardware — fast on Apple Silicon and modern x86, slow on older machines.

These APIs are useful for lightweight, latency-sensitive tasks where you do not want to make a network round-trip. They are not a replacement for cloud models (Gemini Nano is much less capable than Gemini Pro/Ultra or Claude).

### 3.3 Chrome Auto Browse

A Chrome-native autonomous browsing feature powered by Gemini 3. This is a **built-in browser feature**, not an extension API. Users trigger it from the address bar. It is not programmable from extensions and therefore not directly useful for Pavo, but represents where Chrome is headed with agent capabilities.

---

## 4. Pavo's Implementation

### 4.1 Architecture

```
┌──────────────────┐     chrome.runtime      ┌──────────────────────┐
│                  │      .sendMessage()      │                      │
│   Side Panel     │ ──────────────────────── │   Background         │
│   (React App)    │                          │   Service Worker     │
│                  │ ◄─────────────────────── │                      │
│  tools.ts        │     sendResponse()       │  background.ts       │
│  messaging.ts    │                          │                      │
└──────────────────┘                          └──────────┬───────────┘
                                                         │
                                              Chrome Extension APIs
                                                         │
                                              ┌──────────┴───────────┐
                                              │                      │
                                    captureVisibleTab()    scripting.executeScript()
                                              │                      │
                                              ▼                      ▼
                                    ┌─────────────┐       ┌──────────────┐
                                    │  Screenshot  │       │  Page DOM    │
                                    │  (base64)    │       │  (text)      │
                                    └─────────────┘       └──────────────┘
```

**Flow for `getScreenshot`:**

1. AI model calls the `getScreenshot` tool
2. `tools.ts` calls `sendToBackground("CAPTURE_SCREENSHOT")`
3. `messaging.ts` sends a `chrome.runtime.sendMessage` to the background
4. `background.ts` receives the message, calls `chrome.tabs.captureVisibleTab(null, { format: "png" }, callback)`
5. The callback receives the base64 data URL and sends it back via `sendResponse`
6. The tool returns `{ imageDataUrl: dataUrl }` to the AI model

**Flow for `getPageContent`:**

1. AI model calls the `getPageContent` tool
2. `tools.ts` calls `sendToBackground("GET_PAGE_CONTENT")`
3. `background.ts` queries the active tab, then calls `chrome.scripting.executeScript` with an inline function
4. The inline function reads `document.title`, `window.location.href`, the text content of the best semantic container (`article > main > body`), and the meta description
5. Results are sent back via `sendResponse`

### 4.2 No manifest changes needed

The current `manifest.json` already has everything required:

```json
{
  "permissions": ["sidePanel", "storage", "activeTab", "scripting", "commands"],
  "host_permissions": ["<all_urls>"]
}
```

- `"scripting"` — needed for `chrome.scripting.executeScript`
- `"activeTab"` — grants temporary access to the active tab on user gesture
- `"<all_urls>"` — needed for `chrome.tabs.captureVisibleTab` and for injecting scripts into any page
- `"storage"` — needed for `chrome.storage.session` (tab state caching)

No `"debugger"` permission is needed because Pavo uses `captureVisibleTab` instead of the CDP-based approach.

---

## 5. Complete Code

### 5.1 `src/lib/tools.ts`

```ts
import { tool } from "ai";
import { z } from "zod";
import { sendToBackground } from "./messaging";

export const agentTools = {
  getTime: tool({
    description:
      "Get the current date and time. Use this when the user asks what time or date it is.",
    inputSchema: z.object({}),
    execute: async () => ({
      currentTime: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      formatted: new Date().toLocaleString(),
    }),
  }),

  getScreenshot: tool({
    description:
      "Take a screenshot of the currently visible browser tab. Returns a base64-encoded PNG data URL. Use this when the user asks to see or analyze what's on their screen.",
    inputSchema: z.object({}),
    execute: async () => {
      const { dataUrl } = await sendToBackground("CAPTURE_SCREENSHOT");
      return { imageDataUrl: dataUrl };
    },
  }),

  getPageContent: tool({
    description:
      "Extract the text content of the current browser tab. Returns the page title, URL, main text content, and meta description. Use this when the user asks to summarize, analyze, or read the current page.",
    inputSchema: z.object({}),
    execute: async () => {
      return await sendToBackground("GET_PAGE_CONTENT");
    },
  }),
};

export type AgentTools = typeof agentTools;
```

### 5.2 `src/lib/messaging.ts`

```ts
export interface BackgroundMessages {
  CAPTURE_SCREENSHOT: { response: { dataUrl: string } };
  GET_PAGE_CONTENT: {
    response: {
      title: string;
      url: string;
      text: string;
      meta: string;
    };
  };
  GET_ACTIVE_TAB_URL: {
    payload: { tabId?: number };
    response: { url: string | null };
  };
}

type MessageType = keyof BackgroundMessages;

export function sendToBackground<T extends MessageType>(
  type: T,
  payload?: Record<string, unknown>,
): Promise<BackgroundMessages[T]["response"]> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, ...payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (response?.error) {
        reject(new Error(response.error));
        return;
      }
      resolve(response);
    });
  });
}
```

### 5.3 `src/background.ts`

```ts
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.sidePanel.setOptions({
  path: "sidepanel.html",
  enabled: true,
});

interface TabState {
  activeTabId: number | null;
  activeTabUrl: string | null;
}

const tabStateCache = new Map<number, TabState>();

function cacheTabState(tabId: number, url: string | null): void {
  const state: TabState = { activeTabId: tabId, activeTabUrl: url };
  tabStateCache.set(tabId, state);
  chrome.storage.session.set({ activeTabId: tabId, activeTabUrl: url });
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    cacheTabState(tabId, tab.url || null);
  } catch (error) {
    console.error("Error handling tab activation:", error);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    cacheTabState(tabId, tab.url || null);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabStateCache.delete(tabId);
  chrome.storage.session.remove([`tab_${tabId}`]);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case "GET_ACTIVE_TAB_URL": {
      const tabId = message.tabId;
      if (tabId && tabStateCache.has(tabId)) {
        const cached = tabStateCache.get(tabId);
        sendResponse({ url: cached?.activeTabUrl });
      } else if (tabId) {
        chrome.tabs
          .get(tabId)
          .then((tab) => {
            sendResponse({ url: tab.url || null });
          })
          .catch(() => {
            sendResponse({ url: null });
          });
        return true;
      } else {
        sendResponse({ url: null });
      }
      return false;
    }

    case "CAPTURE_SCREENSHOT":
      chrome.tabs.captureVisibleTab(
        null as unknown as number,
        { format: "png" },
        (dataUrl) => {
          if (chrome.runtime.lastError) {
            sendResponse({ error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ dataUrl });
          }
        },
      );
      return true;

    case "GET_PAGE_CONTENT":
      chrome.tabs.query(
        { active: true, currentWindow: true },
        async (tabs) => {
          const tab = tabs[0];
          if (!tab?.id) {
            sendResponse({ error: "No active tab" });
            return;
          }
          try {
            const results = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => {
                const title = document.title;
                const url = window.location.href;
                const article = document.querySelector("article");
                const main = document.querySelector("main");
                const contentEl = article || main || document.body;
                const text = contentEl?.innerText || "";
                const meta =
                  document
                    .querySelector('meta[name="description"]')
                    ?.getAttribute("content") || "";
                return { title, url, text, meta };
              },
            });
            sendResponse(
              results[0]?.result || { error: "Script execution failed" },
            );
          } catch (err) {
            sendResponse({
              error:
                err instanceof Error
                  ? err.message
                  : "Script injection failed",
            });
          }
        },
      );
      return true;

    default:
      return false;
  }
});
```

---

## 6. Gotchas and Rate Limits

### `captureVisibleTab` rate limit

Chrome enforces approximately 2 captures per second. If you call it faster, you get:

```
Error: Throttled: too many captures
```

If the AI agent needs to take multiple screenshots in a loop (e.g., monitoring a page for changes), add a minimum 500ms delay between calls.

### `executeScript` on restricted pages

The following pages cannot be scripted:

- `chrome://` pages (settings, extensions, new tab)
- `chrome-extension://` pages (other extensions)
- `https://chrome.google.com/webstore/` (Chrome Web Store)
- `edge://` pages (if running on Edge)

Always wrap `executeScript` in a try/catch and return a meaningful error to the AI model so it can inform the user.

### Base64 image size

A PNG screenshot of a 1920x1080 viewport is typically 1-4 MB as base64. When sending to an AI model:

- Consider using JPEG format with `quality: 70` to reduce to ~200-400 KB
- Some AI APIs have image size limits (e.g., 5 MB or 20 MB per request)
- Base64 encoding adds ~33% overhead over raw binary

### Service worker lifecycle

The background service worker can be suspended by Chrome after ~30 seconds of inactivity. The `captureVisibleTab` callback and `executeScript` promise will be lost if the worker suspends mid-call. In practice, these calls complete in milliseconds, so suspension is not a real risk for them. It is a risk for longer operations like chaining multiple tool calls.

---

## References

- [chrome.tabs.captureVisibleTab — Chrome for Developers](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-captureVisibleTab)
- [chrome.scripting.executeScript — Chrome for Developers](https://developer.chrome.com/docs/extensions/reference/api/scripting#method-executeScript)
- [chrome.debugger — Chrome for Developers](https://developer.chrome.com/docs/extensions/reference/api/debugger)
- [chrome.tabCapture — Chrome for Developers](https://developer.chrome.com/docs/extensions/reference/api/tabCapture)
- [Chrome DevTools Protocol — Page.captureScreenshot](https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-captureScreenshot)
