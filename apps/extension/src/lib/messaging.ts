let _sourceTabId: number | undefined;
export function setSourceTabId(id: number) {
  _sourceTabId = id;
}

export type MessageType = keyof BackgroundMessages;

export interface BackgroundMessages {
  CAPTURE_SCREENSHOT: {
    payload: Record<string, never>;
    response: { dataUrl: string };
  };
  GET_PAGE_CONTENT: {
    payload: Record<string, never>;
    response: {
      title: string;
      url: string;
      text: string;
      metaDescription: string;
    };
  };
  NAVIGATE_TO: {
    payload: { url: string };
    response: { success: boolean; finalUrl: string };
  };
  GO_BACK: {
    payload: Record<string, never>;
    response: { success: boolean };
  };
  GO_FORWARD: {
    payload: Record<string, never>;
    response: { success: boolean };
  };
  RELOAD_PAGE: {
    payload: Record<string, never>;
    response: { success: boolean };
  };
  CLICK_ELEMENT: {
    payload: { selector?: string; text?: string; nth?: number };
    response: { success: boolean; message: string };
  };
  TYPE_TEXT: {
    payload: { text: string; selector?: string; clearFirst?: boolean };
    response: { success: boolean; message: string };
  };
  PRESS_KEY: {
    payload: { key: string; modifiers?: string[]; selector?: string };
    response: { success: boolean };
  };
  SCROLL_PAGE: {
    payload: {
      direction?: string;
      amount?: number;
      toSelector?: string;
      toPercent?: number;
    };
    response: { success: boolean; scrollY: number };
  };
  HOVER_ELEMENT: {
    payload: { selector: string };
    response: { success: boolean };
  };
  SELECT_OPTION: {
    payload: { selector: string; label?: string; value?: string };
    response: { success: boolean; selectedValue: string };
  };
  FILL_FORM: {
    payload: {
      fields: Array<{ selector: string; value: string; type?: string }>;
      submitSelector?: string;
    };
    response: { success: boolean; filledCount: number; errors: string[] };
  };
  GET_PAGE_STRUCTURE: {
    payload: { filter?: string };
    response: {
      elements: Array<{
        tag: string;
        selector: string;
        label: string;
        type?: string;
        role?: string;
      }>;
    };
  };
  GET_ELEMENT_INFO: {
    payload: { selector: string };
    response: {
      tag: string;
      text: string;
      attributes: Record<string, string>;
      rect: { top: number; left: number; width: number; height: number };
      visible: boolean;
      computedStyles: Record<string, string>;
    };
  };
  GET_PAGE_LINKS: {
    payload: { internalOnly?: boolean; limit?: number };
    response: {
      links: Array<{ href: string; text: string; internal: boolean }>;
    };
  };
  WAIT_FOR_ELEMENT: {
    payload: { selector: string; timeout?: number; visible?: boolean };
    response: { found: boolean; elapsed: number };
  };
  EXTRACT_DATA: {
    payload: {
      description: string;
      containerSelector?: string;
      limit?: number;
    };
    response: { items: unknown[]; count: number };
  };
  EXECUTE_SCRIPT: {
    payload: {
      operation: string;
      selector?: string;
      attribute?: string;
      property?: string;
      value?: string;
      eventName?: string;
      eventDetail?: Record<string, unknown>;
    };
    response: { result: unknown; error?: string };
  };
  GET_TAB_INFO: {
    payload: Record<string, never>;
    response: { url: string; title: string };
  };
}

export function sendToBackground<T extends MessageType>(
  type: T,
  payload?: Record<string, unknown>,
): Promise<BackgroundMessages[T]["response"]> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type, ...payload, _sourceTabId },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response?.error) {
          reject(new Error(response.error));
          return;
        }
        resolve(response);
      },
    );
  });
}
