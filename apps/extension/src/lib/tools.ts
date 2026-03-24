import { tool } from "ai";
import { z } from "zod";
import { sendToBackground } from "./messaging";

const getScreenshot = tool({
  description:
    `Capture a PNG screenshot of the current viewport. ` +
    `Use after actions to visually verify UI state. Cannot capture chrome:// pages. ` +
    `Returns: { imageDataUrl } — base64 PNG data URL. ` +
    `Recovery: If capture fails, retry after 300ms or use getPageContent to check URL/title.`,
  inputSchema: z.object({}),
  execute: async () => {
    const { dataUrl } = await sendToBackground("CAPTURE_SCREENSHOT");
    return { imageDataUrl: dataUrl };
  },
});

const getPageContent = tool({
  description:
    `Extract the page's text content, title, URL, and meta description. ` +
    `Use for reading articles or confirming which page is loaded. Text truncated to ~15k chars. ` +
    `Returns: { title, url, text, metaDescription }. ` +
    `Recovery: If text is empty, try getPageStructure or extractData with a containerSelector.`,
  inputSchema: z.object({}),
  execute: async () => sendToBackground("GET_PAGE_CONTENT"),
});

const navigateTo = tool({
  description:
    `Navigate the active tab to a URL and wait up to 10s for load. ` +
    `Returns: { success, finalUrl } — finalUrl accounts for redirects. ` +
    `Recovery: For SPAs, follow up with waitForElement for a selector that indicates readiness.`,
  inputSchema: z.object({
    url: z.string().describe("Full URL to navigate to, e.g. https://example.com"),
  }),
  execute: async ({ url }) => sendToBackground("NAVIGATE_TO", { url }),
});

const goBack = tool({
  description:
    `Go back one step in browser history. Waits for page load to complete. ` +
    `Returns: { success, currentUrl, pageTitle }. ` +
    `Recovery: If URL unchanged, the page may use client-side routing; try navigateTo instead.`,
  inputSchema: z.object({}),
  execute: async () => sendToBackground("GO_BACK"),
});

const goForward = tool({
  description:
    `Go forward one step in browser history. Waits for page load to complete. ` +
    `Returns: { success, currentUrl, pageTitle }. ` +
    `Recovery: If no effect, use navigateTo to a known URL.`,
  inputSchema: z.object({}),
  execute: async () => sendToBackground("GO_FORWARD"),
});

const reloadPage = tool({
  description:
    `Reload the current page. Waits for load to complete. Use when content is stale or after a failed interaction. ` +
    `Returns: { success, currentUrl, pageTitle }. ` +
    `Recovery: For SPA issues after reload, use waitForElement to confirm readiness.`,
  inputSchema: z.object({}),
  execute: async () => sendToBackground("RELOAD_PAGE"),
});

const clickElement = tool({
  description:
    `Click a DOM element by CSS selector or exact visible text. Dispatches full mousedown→mouseup→click sequence. ` +
    `Params: { selector?, text?, nth? } — nth is 0-based index for multiple matches. ` +
    `Returns: { success, message, clickedTag, currentUrl, pageTitle }. Check currentUrl/pageTitle for navigation side-effects. ` +
    `Recovery: On ELEMENT_NOT_FOUND, call getPageStructure to discover valid selectors.`,
  inputSchema: z.object({
    selector: z.string().optional().describe("CSS selector for the element, e.g. '#submit-btn'"),
    text: z.string().optional().describe("Exact visible text fallback when selector is unknown"),
    nth: z.number().optional().default(0).describe("0-based index when multiple matches"),
  }),
  execute: async (args) => sendToBackground("CLICK_ELEMENT", args),
});

const typeText = tool({
  description:
    `Type text into an input, textarea, or contenteditable element. ` +
    `Params: { text, selector?, clearFirst? } — clearFirst replaces existing value. ` +
    `Returns: { success, message }. ` +
    `Recovery: If characters don't appear, verify with getElementInfo that the target is a focusable input. For div-based editors, use executeScript(setProperty).`,
  inputSchema: z.object({
    text: z.string().describe("The text to type"),
    selector: z.string().optional().describe("Optional CSS selector to focus before typing"),
    clearFirst: z.boolean().optional().default(false).describe("Whether to clear existing content before typing"),
  }),
  execute: async (args) => sendToBackground("TYPE_TEXT", args),
});

const pressKey = tool({
  description:
    `Dispatch a keyboard event (keydown/keypress/keyup). ` +
    `Params: { key, modifiers?, selector? } — key uses KeyboardEvent.key names (Enter, Tab, Escape, ArrowDown). modifiers: ['ctrl','shift','alt','meta']. ` +
    `Returns: { success }. ` +
    `Recovery: If no effect, ensure the correct element is focused via clickElement first.`,
  inputSchema: z.object({
    key: z.string().describe("Key name per KeyboardEvent.key spec, e.g. 'Enter'"),
    modifiers: z
      .array(z.enum(["ctrl", "shift", "alt", "meta"]))
      .optional()
      .default([])
      .describe("Modifier keys to hold"),
    selector: z.string().optional().describe("CSS selector to focus before pressing the key"),
  }),
  execute: async (args) => sendToBackground("PRESS_KEY", args),
});

const scrollPage = tool({
  description:
    `Scroll the page or a detected overflow container. Auto-detects SPA scroll containers. ` +
    `Params: { direction?, amount?, toSelector?, toPercent? } — toSelector scrolls element into view; toPercent jumps to 0-100% of scroll height. ` +
    `Returns: { success, scrollY, scrollHeight, viewportHeight, scrollPercent, atTop, atBottom, container }. Use scrollPercent and atBottom to detect progress and stop conditions. ` +
    `Recovery: If scrollPercent stays 0, the page may use a non-standard scroll container; use executeScript(queryAll) to locate it.`,
  inputSchema: z.object({
    direction: z
      .enum(["up", "down", "left", "right"])
      .optional()
      .default("down"),
    amount: z.number().optional().default(400).describe("Pixels to scroll"),
    toSelector: z.string().optional().describe("CSS selector of an element to scroll into view"),
    toPercent: z.number().optional().describe("Scroll to this percent of the page height (0–100)"),
  }),
  execute: async (args) => sendToBackground("SCROLL_PAGE", args),
});

const hoverElement = tool({
  description:
    `Simulate mouse hover to reveal menus, tooltips, or CSS :hover states. ` +
    `Params: { selector }. ` +
    `Returns: { success }. ` +
    `Recovery: If hover reveals nothing, wait 200-400ms then call getPageStructure to find newly visible elements.`,
  inputSchema: z.object({ selector: z.string().describe("CSS selector of the element to hover over") }),
  execute: async (args) => sendToBackground("HOVER_ELEMENT", args),
});

const selectOption = tool({
  description:
    `Choose an option from a native <select> element. ` +
    `Params: { selector, label?, value? } — supply either label (visible text) or value (attribute). ` +
    `Returns: { success, selectedValue }. ` +
    `Recovery: If it fails, verify with getElementInfo that the target is an HTMLSelectElement. For custom dropdown widgets, use clickElement instead.`,
  inputSchema: z.object({
    selector: z.string().describe("CSS selector of the <select> element"),
    label: z.string().optional().describe("Visible text of the option to pick"),
    value: z.string().optional().describe("Value attribute of the option to pick"),
  }),
  execute: async (args) => sendToBackground("SELECT_OPTION", args),
});

const fillForm = tool({
  description:
    `Fill multiple form fields in one call and optionally submit. ` +
    `Params: { fields: [{selector, value, type?}], submitSelector? } — type can be input/textarea/select/checkbox/radio. ` +
    `Returns: { success, filledCount, errors }. ` +
    `Recovery: Use getPageStructure to find correct selectors for any fields listed in errors.`,
  inputSchema: z.object({
    fields: z
      .array(
        z.object({
          selector: z.string().describe("CSS selector for the form field"),
          value: z.string().describe("Value to fill in"),
          type: z
            .enum(["input", "textarea", "select", "checkbox", "radio"])
            .optional()
            .default("input"),
        }),
      )
      .describe("List of form fields to fill"),
    submitSelector: z.string().optional().describe("CSS selector of submit button to click after filling"),
  }),
  execute: async (args) => sendToBackground("FILL_FORM", args),
});

const getPageStructure = tool({
  description:
    `List visible interactive elements on the page with stable selectors (data-testid, ID, aria-label, name), labels, tags, and roles. Returns up to 80 visible elements, skipping hidden/aria-hidden/zero-size elements. ` +
    `Params: { filter? } — 'interactive' (default, includes ARIA roles), 'inputs', 'links', 'buttons', 'all' (body elements only). ` +
    `Returns: { elements: [{tag, selector, label, type, role}], totalMatched }. ` +
    `When NOT to use: If you need deep DOM detail, use getElementInfo or executeScript(queryAll).`,
  inputSchema: z.object({
    filter: z
      .enum(["all", "interactive", "inputs", "links", "buttons"])
      .optional()
      .default("interactive"),
  }),
  execute: async (args) => sendToBackground("GET_PAGE_STRUCTURE", args),
});

const getElementInfo = tool({
  description:
    `Inspect a single element: text, attributes, bounding rect, visibility, computed styles. ` +
    `Params: { selector }. ` +
    `Returns: { tag, text, attributes, rect, visible, computedStyles }. ` +
    `Use rect to decide if a scroll is needed. Use visible to diagnose display:none issues.`,
  inputSchema: z.object({ selector: z.string().describe("CSS selector of the element") }),
  execute: async (args) => sendToBackground("GET_ELEMENT_INFO", args),
});

const getPageLinks = tool({
  description:
    `Extract anchor links from the page. ` +
    `Params: { internalOnly?, limit? } — internalOnly restricts to same-origin. ` +
    `Returns: { links: [{href, text, internal}] }. ` +
    `Recovery: If links are JS-injected, scroll or waitForElement first to trigger lazy loading.`,
  inputSchema: z.object({
    internalOnly: z.boolean().optional().default(false),
    limit: z.number().optional().default(50),
  }),
  execute: async (args) => sendToBackground("GET_PAGE_LINKS", args),
});

const waitForElement = tool({
  description:
    `Block until a CSS selector appears (and is optionally visible) or timeout. ` +
    `Params: { selector, timeout?, visible? } — timeout in ms (default 5000). ` +
    `Returns: { found, elapsed }. ` +
    `Use after navigateTo or clickElement when content loads asynchronously. Prefer this over arbitrary delays.`,
  inputSchema: z.object({
    selector: z.string().describe("CSS selector to wait for"),
    timeout: z.number().optional().default(5000),
    visible: z.boolean().optional().default(true),
  }),
  execute: async (args) => sendToBackground("WAIT_FOR_ELEMENT", args),
});

const extractData = tool({
  description:
    `Extract repeated structured items (products, results, rows) using a plain-English description. ` +
    `Params: { description, containerSelector?, limit? }. ` +
    `Returns: { items: [{text, html}], count }. ` +
    `Recovery: If items contain unrelated content, narrow with a more specific containerSelector.`,
  inputSchema: z.object({
    description: z.string().describe("Plain-English description of what to extract"),
    containerSelector: z.string().optional().describe("CSS selector to scope the extraction"),
    limit: z.number().optional().default(20),
  }),
  execute: async (args) => sendToBackground("EXTRACT_DATA", args),
});

const executeScript = tool({
  description:
    `Low-level parameterized DOM operations. Use only when higher-level tools cannot accomplish the task. ` +
    `Operations: getAttribute, setAttribute, removeAttribute, getProperty, setProperty, getComputedStyle, dispatchEvent, removeElement, getOuterHTML, setInnerHTML, queryAll, getDocumentMeta. ` +
    `No eval — all operations are pre-compiled for CSP compliance.`,
  inputSchema: z.object({
    operation: z
      .enum([
        "getAttribute",
        "setAttribute",
        "removeAttribute",
        "getProperty",
        "setProperty",
        "getComputedStyle",
        "dispatchEvent",
        "removeElement",
        "getOuterHTML",
        "setInnerHTML",
        "queryAll",
        "getDocumentMeta",
      ])
      .describe("Which pre-built DOM operation to run"),
    selector: z.string().optional().describe("CSS selector of the target element"),
    attribute: z.string().optional().describe("HTML attribute name"),
    property: z.string().optional().describe("JS property or CSS property name"),
    value: z.string().optional().describe("The value to write"),
    eventName: z.string().optional().describe("CustomEvent name (if dispatchEvent)"),
    eventDetail: z.record(z.string(), z.unknown()).optional().describe("Optional detail payload for CustomEvent"),
  }),
  execute: async (args) => sendToBackground("EXECUTE_SCRIPT", args as Record<string, unknown>),
});

const todoWrite = tool({
  description:
    `Create and manage a visible task list for multi-step browser work. The user sees this list in real time. ` +
    `REQUIRED: Call BEFORE starting a multi-step task, then call AGAIN with the SAME sessionId after EVERY step completion to update statuses. ` +
    `Never leave stale statuses — always mark completed tasks as "completed" and move the next to "in_progress" immediately. ` +
    `Frame tasks as outcomes ("Find cheapest flight") not steps ("Click button"). Only 1 task in_progress at a time. ` +
    `Call one final time with overallStatus "completed" when all tasks are done.`,
  inputSchema: z.object({
    sessionId: z.string().describe("Stable UUID for this task list. Reuse when updating, new UUID for new tasks."),
    overallStatus: z.enum(["in_progress", "completed"]).describe("in_progress if any tasks pending/active; completed when all done"),
    todos: z.array(z.object({
      content: z.string().describe("Outcome-focused task description"),
      status: z.enum(["pending", "in_progress", "completed", "interrupted", "cancelled"]),
      activeForm: z.string().optional().describe("Present-continuous description of current work, e.g. 'Searching for flights'"),
      statusContext: z.string().optional().describe("Brief context for interrupted/completed status"),
    })).describe("The full task list with updated statuses"),
  }),
  execute: async (args) => {
    // This is a UI-only tool — the streaming hook intercepts the result
    // to render the task list in the chat. No background message needed.
    return { success: true, ...args };
  },
});

export const agentTools = {
  getScreenshot,
  getPageContent,
  navigateTo,
  goBack,
  goForward,
  reloadPage,
  clickElement,
  typeText,
  pressKey,
  scrollPage,
  hoverElement,
  selectOption,
  fillForm,
  getPageStructure,
  getElementInfo,
  getPageLinks,
  waitForElement,
  extractData,
  executeScript,
  todoWrite,
};

export type AgentTools = typeof agentTools;
export type ToolName = keyof AgentTools;

export const TOOL_META: Record<ToolName, { label: string; iconName: string }> =
  {
    getScreenshot: { label: "Screenshot", iconName: "Camera" },
    getPageContent: { label: "Page content", iconName: "Globe" },
    navigateTo: { label: "Navigate", iconName: "Navigation" },
    goBack: { label: "Go back", iconName: "ArrowLeft" },
    goForward: { label: "Go forward", iconName: "ArrowRight" },
    reloadPage: { label: "Reload", iconName: "RefreshCw" },
    clickElement: { label: "Click", iconName: "MousePointer" },
    typeText: { label: "Type text", iconName: "Type" },
    pressKey: { label: "Press key", iconName: "Command" },
    scrollPage: { label: "Scroll", iconName: "MoveVertical" },
    hoverElement: { label: "Hover", iconName: "MousePointer2" },
    selectOption: { label: "Select option", iconName: "ListChecks" },
    fillForm: { label: "Fill form", iconName: "ClipboardList" },
    getPageStructure: { label: "Page structure", iconName: "LayoutDashboard" },
    getElementInfo: { label: "Element info", iconName: "Info" },
    getPageLinks: { label: "Page links", iconName: "Link" },
    waitForElement: { label: "Wait for element", iconName: "Timer" },
    extractData: { label: "Extract data", iconName: "Database" },
    executeScript: { label: "Run script", iconName: "Terminal" },
    todoWrite: { label: "Task list", iconName: "CheckSquare" },
  };

const { getScreenshot: _gs, ...toolsWithoutScreenshot } = agentTools;

export function getToolsForModel(vision: boolean) {
  return vision ? agentTools : toolsWithoutScreenshot;
}
