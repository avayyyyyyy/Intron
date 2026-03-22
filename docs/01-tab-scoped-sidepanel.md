---

# Tab-Scoped Chrome Extension Side Panel

## Overview

Chrome MV3 extensions can show a side panel — a persistent UI column pinned to the right of the browser window. By default the panel is **window-scoped**: one panel, shared across all tabs. This document explains how to make the panel **tab-scoped** so that each tab gets its own independent panel state, URL, and visibility.

This project (`exten-agent`) is a Twitter automation agent. The side panel is the primary UI. Tab-scoping is essential because the agent must track which Twitter tab it is operating on, maintain per-tab conversation history, and show/hide itself based on whether the active tab is a relevant page.

---

## 1. Chrome Side Panel API Reference

### 1.1 Manifest requirements

```json
{
  "manifest_version": 3,
  "permissions": ["sidePanel"],
  "side_panel": {
    "default_path": "sidepanel.html"
  }
}
```

`"sidePanel"` must be listed in `permissions`. The `side_panel.default_path` sets the HTML loaded when no per-tab override is in effect.

### 1.2 chrome.sidePanel.setPanelBehavior

```ts
chrome.sidePanel.setPanelBehavior(
  behavior: PanelBehavior
): Promise<void>
```

`PanelBehavior`:
- `openPanelOnActionClick: boolean` — When `true`, clicking the toolbar action icon automatically opens the side panel. When `false`, you must call `chrome.sidePanel.open()` explicitly.

This is a **global** setting; it cannot be set per-tab.

### 1.3 chrome.sidePanel.setOptions

```ts
chrome.sidePanel.setOptions(
  options: PanelOptions
): Promise<void>
```

`PanelOptions`:
- `tabId?: number` — If provided, the options apply only to that tab. If omitted, they apply globally (all tabs without a specific override).
- `path?: string` — The HTML file to load in the panel.
- `enabled?: boolean` — Whether the panel is available for this tab. When `false`, clicking the action icon does nothing for that tab.

**Key insight**: calling `setOptions({ path, enabled })` without `tabId` sets a global default. Calling `setOptions({ tabId, path, enabled })` sets a per-tab override that takes precedence over the global default.

### 1.4 chrome.sidePanel.getOptions

```ts
chrome.sidePanel.getOptions(
  options: { tabId?: number }
): Promise<PanelOptions>
```

Returns the currently active options for a tab (or global if no `tabId`). Useful for reading back state.

### 1.5 chrome.sidePanel.open

```ts
chrome.sidePanel.open(
  options: OpenOptions
): Promise<void>
```

`OpenOptions`:
- `windowId?: number` — Open the panel in this window.
- `tabId?: number` — Open the panel anchored to this specific tab.

Must be called from a user gesture context (e.g., inside `chrome.action.onClicked`). Cannot be called from a non-gesture context.

### 1.6 chrome.sidePanel.close  *(Chrome 126+)*

```ts
chrome.sidePanel.close(
  options: { tabId?: number; windowId?: number }
): Promise<void>
```

Programmatically closes the panel. Requires Chrome 126 or later.

---

## 2. Current background.js — Analysis and Problems

The current `background.js` is:

```js
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.sidePanel.setOptions({
  path: "sidepanel.html",
  enabled: true,
});
```

### Problems

| # | Problem | Impact |
|---|---------|--------|
| 1 | `setOptions` has no `tabId` — sets a global default | Panel is enabled on every tab, including non-Twitter pages |
| 2 | No `tabs.onActivated` listener | Background cannot react when the user switches tabs; panel URL cannot update |
| 3 | No `tabs.onRemoved` listener | Per-tab state accumulates in memory forever |
| 4 | No `tabs.onUpdated` listener | Panel cannot re-evaluate when a tab navigates to a new URL |
| 5 | `setPanelBehavior({ openPanelOnActionClick: true })` is global | Cannot selectively prevent the panel from opening on irrelevant tabs |
| 6 | No message passing from panel to background | Panel has no way to tell background which tab it is operating on |
| 7 | Service worker may suspend mid-operation | Async chains started by a message may die before completion |

---

## 3. Tab-Scoped Side Panel: How It Works

The Chrome side panel model works as follows:

1. The **window** holds one visible side panel at a time.
2. When the user switches tabs, Chrome automatically swaps the panel's `path` and `enabled` state to match the options set for the newly active tab.
3. The panel HTML/JS itself is re-loaded when the path changes, or kept alive if the path is the same (same-origin, same file).
4. Per-tab options set via `setOptions({ tabId })` take priority over global options.

To achieve true tab-scoping:

- Set a **global default** with `enabled: false` so unknown tabs get no panel.
- On `tabs.onActivated` and `tabs.onUpdated`, evaluate the new tab's URL and call `setOptions({ tabId, enabled: true/false, path: "..." })` accordingly.
- Pass the active `tabId` to the side panel via `chrome.runtime.sendMessage` or `chrome.storage.session` so the panel UI knows which tab to target.
- Clean up per-tab state in `tabs.onRemoved`.

---

## 4. Per-Tab State Management

### 4.1 In-memory store in the service worker

```ts
// background.ts

interface TabState {
  enabled: boolean;
  url: string | null;
  agentRunning: boolean;
  conversationId: string | null;
}

// Keyed by tabId (number)
const tabState = new Map<number, TabState>();

function getTabState(tabId: number): TabState {
  if (!tabState.has(tabId)) {
    tabState.set(tabId, {
      enabled: false,
      url: null,
      agentRunning: false,
      conversationId: null,
    });
  }
  return tabState.get(tabId)!;
}

function deleteTabState(tabId: number): void {
  tabState.delete(tabId);
}
```

**Pitfall**: The service worker can be killed and restarted at any time. In-memory state is lost on restart. For durable state, use `chrome.storage.session` (cleared on browser close) or `chrome.storage.local` (persists across restarts).

### 4.2 Session storage fallback

```ts
async function persistTabState(tabId: number, state: TabState): Promise<void> {
  await chrome.storage.session.set({ [`tab_${tabId}`]: state });
}

async function loadTabState(tabId: number): Promise<TabState | null> {
  const result = await chrome.storage.session.get(`tab_${tabId}`);
  return result[`tab_${tabId}`] ?? null;
}
```

`chrome.storage.session` requires `"storage"` permission (already present in this project's manifest) and Chrome 102+.

---

## 5. Full Implementation

### 5.1 background.ts (complete rewrite)

```ts
// background.ts
// Tab-scoped side panel management for the Twitter Agent extension.

const TWITTER_ORIGINS = ["https://twitter.com", "https://x.com"];

interface TabAgentState {
  agentRunning: boolean;
  conversationId: string | null;
  lastUrl: string | null;
}

// In-memory cache; backed by chrome.storage.session for SW restarts.
const tabAgentState = new Map<number, TabAgentState>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isTwitterUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const origin = new URL(url).origin;
    return TWITTER_ORIGINS.some((o) => origin === o);
  } catch {
    return false;
  }
}

async function enablePanelForTab(tabId: number, url: string): Promise<void> {
  await chrome.sidePanel.setOptions({
    tabId,
    path: "sidepanel.html",
    enabled: true,
  });
  // Persist the URL for this tab so the panel can read it.
  await chrome.storage.session.set({ [`activeTabUrl_${tabId}`]: url });
}

async function disablePanelForTab(tabId: number): Promise<void> {
  await chrome.sidePanel.setOptions({
    tabId,
    path: "sidepanel.html",
    enabled: false,
  });
}

async function evaluateTab(tabId: number, url: string | undefined): Promise<void> {
  if (isTwitterUrl(url)) {
    await enablePanelForTab(tabId, url!);
  } else {
    await disablePanelForTab(tabId);
  }
}

// ─── Initialization ───────────────────────────────────────────────────────────

// Disable the panel globally; enable only on relevant tabs.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
chrome.sidePanel.setOptions({ path: "sidepanel.html", enabled: false });

// ─── Tab lifecycle ────────────────────────────────────────────────────────────

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  await evaluateTab(tabId, tab.url ?? tab.pendingUrl);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only act when the URL has actually changed and the tab is the active one.
  if (changeInfo.url) {
    await evaluateTab(tabId, changeInfo.url);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  // Clean up session storage.
  await chrome.storage.session.remove([
    `activeTabUrl_${tabId}`,
    `agentState_${tabId}`,
  ]);
  tabAgentState.delete(tabId);
  // Remove per-tab panel options so the global default takes over.
  // Note: Chrome automatically removes per-tab options when the tab closes,
  // but explicit removal is defensive and documents intent.
});

// ─── Action icon click ────────────────────────────────────────────────────────

// openPanelOnActionClick: true means Chrome handles the open automatically.
// We listen here only to handle tabs where the panel is currently disabled
// and the user clicks anyway — to show a toast or redirect.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  if (!isTwitterUrl(tab.url)) {
    // Panel is disabled; navigate to Twitter instead.
    await chrome.tabs.update(tab.id, { url: "https://x.com" });
  }
  // If the panel is enabled, Chrome already opened it via setPanelBehavior.
});

// ─── Message passing ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.type === "GET_ACTIVE_TAB_URL") {
      // Panel requests the URL of the tab it should operate on.
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];
      sendResponse({ tabId: activeTab?.id, url: activeTab?.url });
    }

    if (message.type === "AGENT_STATE_UPDATE") {
      const { tabId, agentRunning, conversationId } = message;
      tabAgentState.set(tabId, { agentRunning, conversationId, lastUrl: null });
      await chrome.storage.session.set({
        [`agentState_${tabId}`]: { agentRunning, conversationId },
      });
      sendResponse({ ok: true });
    }
  })();
  return true; // Keep message channel open for async sendResponse.
});
```

### 5.2 Panel-side: reading the active tab

The side panel HTML is a single-page React app. It needs to know which tab to operate on. Because the panel is always loaded in the context of the extension (not the tab), `chrome.tabs.getCurrent()` returns `undefined` inside the panel. Instead, ask the background:

```ts
// src/hooks/useActiveTab.ts
import { useEffect, useState } from "react";

interface ActiveTab {
  tabId: number | undefined;
  url: string | undefined;
}

export function useActiveTab(): ActiveTab {
  const [activeTab, setActiveTab] = useState<ActiveTab>({
    tabId: undefined,
    url: undefined,
  });

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "GET_ACTIVE_TAB_URL" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("useActiveTab:", chrome.runtime.lastError.message);
        return;
      }
      setActiveTab({ tabId: response.tabId, url: response.url });
    });

    // Re-query when the user switches tabs (the panel stays alive across switches
    // if the path doesn't change).
    const handleFocus = () => {
      chrome.runtime.sendMessage({ type: "GET_ACTIVE_TAB_URL" }, (response) => {
        if (!chrome.runtime.lastError) {
          setActiveTab({ tabId: response.tabId, url: response.url });
        }
      });
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  return activeTab;
}
```

### 5.3 Scripting into the active tab

When the agent needs to interact with the Twitter page, use `chrome.scripting.executeScript` with the `tabId`:

```ts
async function injectContentScript(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"],
  });
}
```

This requires `"scripting"` permission and `"activeTab"` or a broad host permission — both already present in this project's manifest.

---

## 6. Edge Cases

### 6.1 Tab with no URL yet (new tab page, loading state)

When `tabs.onActivated` fires, `tab.url` may be `undefined` or `"chrome://newtab/"`. Always guard:

```ts
// In evaluateTab:
if (!url || url.startsWith("chrome://")) {
  await disablePanelForTab(tabId);
  return;
}
```

### 6.2 Panel opened on the wrong tab

`chrome.sidePanel.open({ tabId })` anchors the panel to a specific tab, but `openPanelOnActionClick: true` overrides this and opens it for the current tab. If you need strict control, set `openPanelOnActionClick: false` and call `open` manually in `action.onClicked`.

### 6.3 Service worker suspension mid-agent-run

The MV3 service worker suspends after ~30 seconds of inactivity. If the agent is in the middle of a long async operation (e.g., waiting for an AI API response), the SW may be killed. Mitigations:

1. Use `chrome.storage.session` to checkpoint agent state before every await.
2. Move long-running network calls to the side panel (it stays alive as long as it's open).
3. Use `chrome.alarms` to periodically wake the SW if needed (though this has a minimum 1-minute interval in MV3).

### 6.4 Panel URL change vs. panel state preservation

When the panel `path` changes (different `tabId` getting different options), Chrome reloads the panel HTML. If you use the same `path` for all tabs, Chrome keeps the same panel document alive across tab switches — meaning React state persists. This is usually desirable but can cause stale state bugs if the panel doesn't re-query the active tab on focus.

The `window.addEventListener("focus", ...)` in `useActiveTab` above handles this case.

### 6.5 Multiple windows

`chrome.tabs.onActivated` includes a `windowId`. `chrome.tabs.query({ active: true, currentWindow: true })` only returns the tab in the focused window. If the user has two windows open with the extension, each window's side panel is independent. The current implementation handles this correctly because `setOptions({ tabId })` operates on the global tab ID space, not per-window.

### 6.6 Incognito tabs

Side panels are not available in incognito tabs unless the extension is explicitly allowed in incognito mode by the user. Do not set `tabId` options for incognito tabs — it will throw. Guard with:

```ts
const tab = await chrome.tabs.get(tabId);
if (tab.incognito) return;
```

### 6.7 Tab groups and pinned tabs

No special handling needed. `setOptions({ tabId })` works on any normal tab regardless of group or pin state.

### 6.8 `chrome.sidePanel.close` availability

`chrome.sidePanel.close` requires Chrome 126+. As of March 2026, Chrome stable is well past 126, so this is safe to use. If you need to support older versions:

```ts
if (chrome.sidePanel.close) {
  await chrome.sidePanel.close({ tabId });
}
```

---

## 7. Pitfalls

### 7.1 Calling `setOptions` without `tabId` overwrites the global default

If you call `setOptions({ path: "sidepanel.html", enabled: true })` at the top level (as the current background.js does), you enable the panel for every tab with no per-tab override. This cannot be undone tab-by-tab without explicitly setting `enabled: false` for each tab. Always set the global default to `enabled: false` first, then enable per-tab.

### 7.2 `chrome.sidePanel.open` requires a user gesture

You cannot call `chrome.sidePanel.open` from:
- `tabs.onActivated` handlers
- `tabs.onUpdated` handlers
- `runtime.onMessage` handlers (unless triggered by a user action in the panel)
- Alarm callbacks

You **can** call it from:
- `action.onClicked`
- `contextMenus.onClicked`
- A message sent explicitly by the user clicking a button in the panel

If you try to call `open` outside a gesture, Chrome throws: `"chrome.sidePanel.open() may only be called from a user gesture"`.

### 7.3 `setPanelBehavior` cannot be reverted per-tab

`openPanelOnActionClick` is window-level. You cannot set it `true` for some tabs and `false` for others. The workaround is to set it `false` globally and call `open` manually, or set `enabled: false` for tabs where you don't want the panel to open at all (clicking the action icon on a disabled-panel tab does nothing).

### 7.4 Panel lifecycle is not the same as tab lifecycle

The panel document is not destroyed when the user switches tabs (if the path is the same). React component state persists. Effects do NOT re-run. This means:
- A `useEffect(() => { fetchData() }, [])` in the panel will only run once when the panel first opens, not on every tab switch.
- You must use the `window.focus` event or a Chrome runtime message to re-initialize panel state on tab switches.

### 7.5 `chrome.tabs.onUpdated` fires many times

`onUpdated` fires for `status: "loading"`, `status: "complete"`, favicon changes, title changes, and URL changes. Only filter on `changeInfo.url` to avoid redundant `setOptions` calls:

```ts
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (!changeInfo.url) return; // ignore non-URL updates
  await evaluateTab(tabId, changeInfo.url);
});
```

### 7.6 Extension reload clears in-memory tab state

When you reload the extension during development (`chrome://extensions` → reload), the service worker restarts and the `tabState` Map is wiped. Any tabs that previously had `enabled: true` will keep their `setOptions` state (Chrome holds onto it) but the in-memory `tabAgentState` is gone. This can cause the panel to show stale agent state. Always re-hydrate from `chrome.storage.session` on SW startup.

### 7.7 `sender.tab` is undefined in side panel messages

When the side panel sends a message via `chrome.runtime.sendMessage`, `sender.tab` is `undefined` because the panel runs in the extension context, not in a tab. Do not rely on `sender.tab.id` to identify which tab the panel is targeting. Instead, have the panel explicitly include the `tabId` in its messages.

---

## 8. Recommended manifest.json changes

No manifest changes are required for tab-scoping. The current manifest already has:
- `"sidePanel"` permission
- `"storage"` permission (needed for `chrome.storage.session`)
- `"activeTab"` and `"scripting"` (needed for content script injection)
- `"side_panel": { "default_path": "sidepanel.html" }`

The `default_path` in the manifest and the `path` in `setOptions` both point to the same file. This is correct and intentional — the manifest sets the fallback, `setOptions` sets the per-tab or global override at runtime.

---

## 9. Summary of changes to make

| File | Change |
|------|--------|
| `background.js` → `background.ts` | Full rewrite per Section 5.1 |
| `src/hooks/useActiveTab.ts` | New file per Section 5.2 |
| `src/App.tsx` | Use `useActiveTab()` hook; conditionally render agent UI based on whether `url` is a Twitter URL |
| `manifest.json` | No changes needed |

---

## 10. Tab Groups + Sidepanel Integration (Implemented)

### What we built

When the user clicks the extension icon or the agent calls a tool, the active tab is added to a **"Pavo" tab group** (cyan color). The sidepanel is only enabled on tabs inside a Pavo group — switching to an ungrouped tab hides the sidepanel.

### Architecture

```
User clicks icon
  → setOptions({ tabId, enabled: true })    // fire-and-forget, NO await
  → await sidePanel.open({ tabId })          // first await = gesture context preserved
  → await ensurePavoGroup(tab)               // creates cyan "Pavo" group

Agent calls a tool
  → FIND_OR_CREATE_PAVO_GROUP message
  → enables sidepanel + groups tab

User switches to ungrouped tab
  → tabs.onUpdated detects groupId change
  → setOptions({ tabId, enabled: false })
  → sidepanel disappears

User switches back to Pavo tab
  → sidepanel reappears
```

### Critical: `sidePanel.open()` gesture context

`chrome.sidePanel.open()` **must be the first `await`** in an `action.onClicked` handler. Chrome's user gesture context survives through the first async boundary but not subsequent ones.

```ts
// WRONG — kills gesture context
await chrome.sidePanel.setOptions({ tabId, enabled: true });
await chrome.sidePanel.open({ tabId });  // ❌ "may only be called in response to a user gesture"

// CORRECT — setOptions fire-and-forget, open() is first await
chrome.sidePanel.setOptions({ tabId, enabled: true });  // no await
await chrome.sidePanel.open({ tabId });                  // ✅ first await = gesture intact
```

### Permissions required

```json
"permissions": ["sidePanel", "tabGroups", ...]
```

### Tab group behavior

- **Each click = new group**: clicking the icon on a new tab creates a separate Pavo group (1 tab per group)
- **Already in Pavo group**: reuses existing group
- **Multiple Pavo groups coexist**: each sidepanel session tracks its own via `activePavoGroupId`
- **`navigateTo` targets the Pavo tab**: `getPavoTab()` finds the tab in this session's group, navigates there without stealing focus
- **Tab leaves group → sidepanel disables**: `tabs.onUpdated` listens for `groupId` changes

### Key helper: `ensurePavoGroup(tab)`

```ts
async function ensurePavoGroup(tab: chrome.tabs.Tab): Promise<number> {
  // If already in a Pavo group, return it
  if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
    const group = await chrome.tabGroups.get(tab.groupId);
    if (group.title === "Pavo") return group.id;
  }
  // Create new group (1 tab each, multiple groups can coexist)
  const groupId = await chrome.tabs.group({
    tabIds: tab.id!,
    createProperties: { windowId: tab.windowId },
  });
  await chrome.tabGroups.update(groupId, { title: "Pavo", color: "cyan" });
  return groupId;
}
```

### Chrome tab group API gotchas

- `chrome.tabGroups.onUpdated` fires on title/color changes but NOT on membership changes — use `chrome.tabs.onUpdated` with `"groupId" in changeInfo` to detect when tabs join/leave groups
- Empty groups are auto-deleted by Chrome
- Group colors are limited to: grey, blue, red, yellow, green, pink, purple, cyan, orange
- `chrome.tabGroups.TAB_GROUP_ID_NONE` (-1) means the tab is not in any group

---

## References

- [Chrome Side Panel API — Chrome for Developers](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [Side Panel — Chrome Extensions Samples](https://github.com/GoogleChrome/chrome-extensions-samples/tree/main/functional-samples/sample.sidepanel-global)
- [Manage events with service workers (MV3)](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/events)
- [chrome.storage.session](https://developer.chrome.com/docs/extensions/reference/api/storage#property-session)
