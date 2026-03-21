import { tool } from "ai";
import { z } from "zod";
import { sendToBackground } from "./messaging";

const getScreenshot = tool({
  description:
    "Take a screenshot of the currently visible browser tab. Returns a base64-encoded PNG data URL. Use this when the user asks to see or analyze what's on their screen.",
  inputSchema: z.object({}),
  execute: async () => {
    const { dataUrl } = await sendToBackground("CAPTURE_SCREENSHOT");
    return { imageDataUrl: dataUrl };
  },
});

const getPageContent = tool({
  description:
    "Extract the text content of the current browser tab. Returns the page title, URL, main text content, and meta description. Use this when the user asks to summarize, analyze, or read the current page.",
  inputSchema: z.object({}),
  execute: async () => sendToBackground("GET_PAGE_CONTENT"),
});

const navigateTo = tool({
  description:
    "Navigate the current browser tab to a given URL. Use this to open a website or move to a specific page.",
  inputSchema: z.object({
    url: z
      .string()
      .describe("The full URL to navigate to, e.g. https://example.com"),
  }),
  execute: async ({ url }) => sendToBackground("NAVIGATE_TO", { url }),
});

const goBack = tool({
  description:
    "Go back one step in the browser history, like pressing the Back button.",
  inputSchema: z.object({}),
  execute: async () => sendToBackground("GO_BACK"),
});

const goForward = tool({
  description:
    "Go forward one step in the browser history, like pressing the Forward button.",
  inputSchema: z.object({}),
  execute: async () => sendToBackground("GO_FORWARD"),
});

const reloadPage = tool({
  description: "Reload / refresh the current browser tab.",
  inputSchema: z.object({}),
  execute: async () => sendToBackground("RELOAD_PAGE"),
});

const clickElement = tool({
  description:
    "Click an element on the page identified by a CSS selector or its visible text. Use getPageContent or getPageStructure first if you are unsure of the selector.",
  inputSchema: z.object({
    selector: z
      .string()
      .optional()
      .describe(
        "CSS selector for the element, e.g. '#submit-btn' or 'button.primary'",
      ),
    text: z
      .string()
      .optional()
      .describe(
        "Visible text of the element to click, used as a fallback when selector is unknown",
      ),
    nth: z
      .number()
      .optional()
      .default(0)
      .describe("0-based index when multiple elements match"),
  }),
  execute: async (args) => sendToBackground("CLICK_ELEMENT", args),
});

const typeText = tool({
  description:
    "Type text into a focused input, textarea, or contenteditable element. Optionally target a specific element by selector first.",
  inputSchema: z.object({
    text: z.string().describe("The text to type"),
    selector: z
      .string()
      .optional()
      .describe("CSS selector of the element to focus before typing"),
    clearFirst: z
      .boolean()
      .optional()
      .default(false)
      .describe("Whether to clear existing content before typing"),
  }),
  execute: async (args) => sendToBackground("TYPE_TEXT", args),
});

const pressKey = tool({
  description:
    "Simulate a keyboard key press or shortcut, e.g. Enter, Tab, Escape, ArrowDown, or Ctrl+A. Useful after typing or to confirm dialogs.",
  inputSchema: z.object({
    key: z
      .string()
      .describe(
        "Key name per KeyboardEvent.key spec, e.g. 'Enter', 'Tab', 'Escape', 'ArrowDown'",
      ),
    modifiers: z
      .array(z.enum(["ctrl", "shift", "alt", "meta"]))
      .optional()
      .default([])
      .describe("Modifier keys to hold while pressing the key"),
    selector: z
      .string()
      .optional()
      .describe("CSS selector of element to focus before pressing the key"),
  }),
  execute: async (args) => sendToBackground("PRESS_KEY", args),
});

const scrollPage = tool({
  description:
    "Scroll the page or a specific element. Can scroll by pixel amount, to a percentage of the page, or to a specific element.",
  inputSchema: z.object({
    direction: z
      .enum(["up", "down", "left", "right"])
      .optional()
      .default("down"),
    amount: z.number().optional().default(400).describe("Pixels to scroll"),
    toSelector: z
      .string()
      .optional()
      .describe("CSS selector of an element to scroll into view"),
    toPercent: z
      .number()
      .optional()
      .describe("Scroll to this % of the page height (0–100)"),
  }),
  execute: async (args) => sendToBackground("SCROLL_PAGE", args),
});

const hoverElement = tool({
  description:
    "Move the mouse over an element to trigger hover effects or reveal hidden menus/tooltips.",
  inputSchema: z.object({
    selector: z.string().describe("CSS selector of the element to hover over"),
  }),
  execute: async (args) => sendToBackground("HOVER_ELEMENT", args),
});

const selectOption = tool({
  description:
    "Select an option from a <select> dropdown element by its visible label or value.",
  inputSchema: z.object({
    selector: z.string().describe("CSS selector of the <select> element"),
    label: z
      .string()
      .optional()
      .describe("Visible text of the option to select"),
    value: z
      .string()
      .optional()
      .describe("Value attribute of the option to select"),
  }),
  execute: async (args) => sendToBackground("SELECT_OPTION", args),
});

const fillForm = tool({
  description:
    "Fill multiple form fields at once. Accepts a map of CSS selectors to values. Supports inputs, textareas, and select elements.",
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
    submitSelector: z
      .string()
      .optional()
      .describe("CSS selector of submit button to click after filling"),
  }),
  execute: async (args) => sendToBackground("FILL_FORM", args),
});

const getPageStructure = tool({
  description:
    "Get a simplified accessibility tree / DOM outline of the current page, listing interactive elements (buttons, links, inputs) with their selectors and visible labels. Use this to identify what you can interact with.",
  inputSchema: z.object({
    filter: z
      .enum(["all", "interactive", "inputs", "links", "buttons"])
      .optional()
      .default("interactive")
      .describe("Which elements to include in the tree"),
  }),
  execute: async (args) => sendToBackground("GET_PAGE_STRUCTURE", args),
});

const getElementInfo = tool({
  description:
    "Get detailed information about a specific element: its tag, text, attributes, bounding rect, visibility, and computed styles.",
  inputSchema: z.object({
    selector: z.string().describe("CSS selector of the element"),
  }),
  execute: async (args) => sendToBackground("GET_ELEMENT_INFO", args),
});

const getPageLinks = tool({
  description:
    "Extract all hyperlinks on the current page, returning their href, text, and whether they're internal or external.",
  inputSchema: z.object({
    internalOnly: z.boolean().optional().default(false),
    limit: z.number().optional().default(50),
  }),
  execute: async (args) => sendToBackground("GET_PAGE_LINKS", args),
});

const waitForElement = tool({
  description:
    "Wait until a CSS selector is present in the DOM and visible. Useful after navigation or after triggering an action that loads new content.",
  inputSchema: z.object({
    selector: z.string().describe("CSS selector to wait for"),
    timeout: z
      .number()
      .optional()
      .default(5000)
      .describe("Max wait time in milliseconds"),
    visible: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        "Whether to wait for the element to be visible, not just present",
      ),
  }),
  execute: async (args) => sendToBackground("WAIT_FOR_ELEMENT", args),
});

const extractData = tool({
  description:
    "Extract structured data from the page using a schema description. Useful for scraping tables, lists, product info, search results, or any repeated pattern.",
  inputSchema: z.object({
    description: z
      .string()
      .describe(
        "Plain-English description of what to extract, e.g. 'all product names and prices in the grid'",
      ),
    containerSelector: z
      .string()
      .optional()
      .describe(
        "CSS selector of the container element to scope the extraction",
      ),
    limit: z
      .number()
      .optional()
      .default(20)
      .describe("Max number of items to return"),
  }),
  execute: async (args) => sendToBackground("EXTRACT_DATA", args),
});

// ─── Script Execution ──────────────────────────────────────────────────────────
//
// eval() is permanently blocked in Chrome extensions (all worlds, all CSP configs).
// This tool exposes pre-compiled, parameterized DOM operations instead.
// The func bodies are compiled at build-time; only the arguments are dynamic.

const executeScript = tool({
  description:
    "Low-level DOM escape hatch. Use when no other tool covers the interaction. " +
    "Runs a named pre-built operation on a page element identified by a CSS selector. " +
    "Operations: getAttribute, setAttribute, removeAttribute, getProperty, setProperty, " +
    "getComputedStyle, dispatchEvent, removeElement, getOuterHTML, setInnerHTML, queryAll, getDocumentMeta.",
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
    selector: z
      .string()
      .optional()
      .describe(
        "CSS selector of the target element (required for most operations)",
      ),
    attribute: z
      .string()
      .optional()
      .describe(
        "HTML attribute name — required for getAttribute / setAttribute / removeAttribute",
      ),
    property: z
      .string()
      .optional()
      .describe(
        "JS property name or CSS property name — required for getProperty / setProperty / getComputedStyle",
      ),
    value: z
      .string()
      .optional()
      .describe(
        "The value to write — required for setAttribute, setProperty, setInnerHTML",
      ),
    eventName: z
      .string()
      .optional()
      .describe(
        "CustomEvent type name — required for dispatchEvent, e.g. 'click', 'change', 'my-custom-event'",
      ),
    eventDetail: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        "Optional detail payload passed to the CustomEvent constructor",
      ),
  }),
  execute: async (args) =>
    sendToBackground("EXECUTE_SCRIPT", args as Record<string, unknown>),
});

const openTab = tool({
  description: "Open a new browser tab, optionally navigating to a URL.",
  inputSchema: z.object({
    url: z.string().optional().describe("URL to open in the new tab"),
    active: z
      .boolean()
      .optional()
      .default(true)
      .describe("Switch to new tab immediately"),
  }),
  execute: async (args) => sendToBackground("OPEN_TAB", args),
});

export const agentTools = {
  // Core info
  getScreenshot,
  getPageContent,
  // Navigation
  navigateTo,
  goBack,
  goForward,
  reloadPage,
  // DOM interaction
  clickElement,
  typeText,
  pressKey,
  scrollPage,
  hoverElement,
  selectOption,
  fillForm,
  // Page inspection
  getPageStructure,
  getElementInfo,
  getPageLinks,
  waitForElement,
  extractData,
  // Scripting
  executeScript,
  // Tabs
  openTab,
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
    openTab: { label: "Open tab", iconName: "Plus" },
  };

const { getScreenshot: _gs, ...toolsWithoutScreenshot } = agentTools;

export function getToolsForModel(vision: boolean) {
  return vision ? agentTools : toolsWithoutScreenshot;
}
