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
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
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
              err instanceof Error ? err.message : "Script injection failed",
          });
        }
      });
      return true;

    default:
      return false;
  }
});
