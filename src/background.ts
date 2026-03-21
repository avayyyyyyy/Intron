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

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const { tabId } = activeInfo;
  try {
    const tab = await chrome.tabs.get(tabId);
    const state: TabState = {
      activeTabId: tabId,
      activeTabUrl: tab.url || null,
    };
    tabStateCache.set(tabId, state);
    await chrome.storage.session.set({
      activeTabId: tabId,
      activeTabUrl: tab.url || null,
    });
  } catch (error) {
    console.error("Error handling tab activation:", error);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    const state: TabState = {
      activeTabId: tabId,
      activeTabUrl: tab.url || null,
    };
    tabStateCache.set(tabId, state);
    chrome.storage.session.set({
      activeTabId: tabId,
      activeTabUrl: tab.url || null,
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabStateCache.delete(tabId);
  chrome.storage.session.remove([`tab_${tabId}`]);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_ACTIVE_TAB_URL") {
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
  }
  return false;
});
