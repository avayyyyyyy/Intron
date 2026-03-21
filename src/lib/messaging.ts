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
