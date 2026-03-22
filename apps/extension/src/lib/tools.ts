import { tool } from "ai";
import { z } from "zod";
import { sendToBackground } from "./messaging";

// Enhanced tool descriptions: each description follows a short "purpose" line
// then these sections: When to use, Prerequisites, Params (with examples),
// Returns (fields explained), Common failure modes and recovery suggestions.

const makeDesc = (s: string) => s; // helper so strings are easier to edit

const getScreenshot = tool({
  description: makeDesc(
    `Purpose: Capture a PNG screenshot of the currently visible browser viewport.\n\n` +
      `When to use: Use when you need a visual snapshot for analysis, OCR, or to confirm UI state after an action (click/submit).\n\n` +
      `Prerequisites: The target tab must be visible to the OS/compositor; extensions cannot capture chrome:// pages.\n\n` +
      `Params: none. Example usage: call immediately after navigation to prove what the user sees.\n\n` +
      `Returns: { imageDataUrl } where imageDataUrl is a base64 data: URL (PNG).\n` +
      `Common failures and recovery: If capture fails, retry once after a 300ms delay and/or call getPageContent to re-check URL/title before retrying.`,
  ),
  inputSchema: z.object({}),
  execute: async () => {
    const { dataUrl } = await sendToBackground("CAPTURE_SCREENSHOT");
    return { imageDataUrl: dataUrl };
  },
});

const getPageContent = tool({
  description: makeDesc(
    `Purpose: Extract the human-readable textual content of the current page.\n\n` +
      `When to use: Use this when you need to summarize, search, or extract main article/text content. Not ideal for structured lists—use extractData for that.\n\n` +
      `Prerequisites: The page should have finished loading (navigateTo → waitForElement recommended for SPAs).\n\n` +
      `Params: none. Example usage: After navigation or after significant UI changes.\n\n` +
      `Returns: { title, url, text, metaDescription } where text is truncated to ~15k chars. Use url/title to re-ground if content seems unexpected.\n\n` +
      `Common failures and recovery: If text is empty or truncated, consider calling getPageStructure or extractData with a containerSelector to capture structured areas.`,
  ),
  inputSchema: z.object({}),
  execute: async () => sendToBackground("GET_PAGE_CONTENT"),
});

const navigateTo = tool({
  description: makeDesc(
    `Purpose: Navigate the active tab to the provided URL and wait for load.\n\n` +
      `When to use: Opening a site, following a link you computed, or landing on a known start page.\n\n` +
      `Prerequisites: None; this tool will wait up to 10s for the tab to reach "complete". For SPAs that render after "complete", call waitForElement afterwards.\n\n` +
      `Params: { url } e.g. https://example.com/login.\n\n` +
      `Returns: { success, finalUrl, currentUrl, pageTitle } — finalUrl accounts for redirects. Use these fields to verify you reached the right location before further interactions.\n\n` +
      `Common failures and recovery: If the page times out, consider increasing wait strategy: call navigateTo, then waitForElement for a specific selector that indicates the page is interactive.`,
  ),
  inputSchema: z.object({
    url: z.string().describe("Full URL to navigate to, e.g. https://example.com"),
  }),
  execute: async ({ url }) => sendToBackground("NAVIGATE_TO", { url }),
});

const goBack = tool({
  description: makeDesc(
    `Purpose: Go back one entry in the browser history (like Back button).\n\n` +
      `When to use: Undo a navigation step or back out of a modal that used pushState.\n\n` +
      `Prerequisites: The current tab must have history.\n\n` +
      `Params: none.\n\n` +
      `Returns: { success, currentUrl, pageTitle } — check currentUrl to detect whether a navigation actually occurred.\n\n` +
      `Common failures and recovery: If the URL doesn't change, the page may have used a client-side history mechanism; consider using executeScript to dispatch a popstate or navigateTo instead.`,
  ),
  inputSchema: z.object({}),
  execute: async () => sendToBackground("GO_BACK"),
});

const goForward = tool({
  description: makeDesc(
    `Purpose: Go forward one entry in browser history (like Forward button).\n\n` +
      `When to use: After a back() when you want to return to the subsequent page.\n\n` +
      `Prerequisites: None.\n\n` +
      `Params: none.\n\n` +
      `Returns: { success, currentUrl, pageTitle } — validate currentUrl as needed.\n\n` +
      `Common failures and recovery: If forward does nothing, try navigateTo to a known URL.`,
  ),
  inputSchema: z.object({}),
  execute: async () => sendToBackground("GO_FORWARD"),
});

const reloadPage = tool({
  description: makeDesc(
    `Purpose: Reload the current page.\n\n` +
      `When to use: When content is stale or after a failed interaction that may be recoverable by a refresh.\n\n` +
      `Prerequisites: None.\n\n` +
      `Params: none.\n\n` +
      `Returns: { success, currentUrl, pageTitle } — use pageTitle/url to re-ground.\n\n` +
      `Common failures and recovery: If reload does not fix dynamic content issues on SPAs, use waitForElement for a specific UI indicator of readiness.`,
  ),
  inputSchema: z.object({}),
  execute: async () => sendToBackground("RELOAD_PAGE"),
});

// DOM interaction tools
const clickElement = tool({
  description: makeDesc(
    `Purpose: Click a visible DOM element.\n\n` +
      `When to use: Trigger buttons, links, and controls that react to click events. Prefer CSS selectors obtained from getPageStructure or getElementInfo.\n\n` +
      `Prerequisites: If the target is not visible immediately after navigation, use waitForElement before calling this.\n\n` +
      `Params: { selector?, text?, nth? } — If you provide selector, it must be a valid CSS selector. If you provide text (visible text), it is matched exactly (trimmed) as a fallback; avoid text matching when punctuation or trimming may differ. nth is 0-based when multiple elements match. Example: { selector: '#submit', nth: 0 }.\n\n` +
      `Returns: { success, message, currentUrl, pageTitle, clickedTag } — check currentUrl/pageTitle for navigation side-effects and clickedTag to confirm what element was activated.\n\n` +
      `Common failures and recovery: On ELEMENT_NOT_FOUND, call getPageStructure({filter:'interactive'}) and select a robust selector (id/class). If clicks appear to do nothing, try hoverElement(selector) then click, or use pressKey({key:'Enter'}) for keyboard-activatable controls.`,
  ),
  inputSchema: z.object({
    selector: z.string().optional().describe("CSS selector for the element, e.g. '#submit-btn'"),
    text: z.string().optional().describe("Exact visible text fallback when selector is unknown"),
    nth: z.number().optional().default(0).describe("0-based index when multiple matches"),
  }),
  execute: async (args) => sendToBackground("CLICK_ELEMENT", args),
});

const typeText = tool({
  description: makeDesc(
    `Purpose: Type text into an input, textarea, or contenteditable.\n\n` +
      `When to use: Enter values into form fields one at a time. For filling many fields, prefer fillForm.\n\n` +
      `Prerequisites: Ensure the target is visible and focusable (use waitForElement or clickElement to focus).\n\n` +
      `Params: { text, selector?, clearFirst? } — Provide selector to target a specific field. clearFirst=true will replace the existing value. Example: { selector:'#email', text:'user@example.com', clearFirst:true }.\n\n` +
      `Returns: { success, message, fieldSelector, currentValue } — verify currentValue to ensure the input contains the intended text.\n\n` +
      `Common failures and recovery: If characters do not appear, use getElementInfo(selector) to confirm the element is an input/textarea; for non-standard inputs (div-based editors) use executeScript to set innerText or setProperty('value').`,
  ),
  inputSchema: z.object({
    text: z.string().describe("The text to type"),
    selector: z.string().optional().describe("Optional CSS selector to focus before typing"),
    clearFirst: z.boolean().optional().default(false).describe("Whether to clear existing content before typing"),
  }),
  execute: async (args) => sendToBackground("TYPE_TEXT", args),
});

const pressKey = tool({
  description: makeDesc(
    `Purpose: Dispatch keyboard events to the page (keydown/keypress/keyup).\n\n` +
      `When to use: Submit forms (Enter), navigate focus (Tab), close modals (Escape), or trigger keyboard-driven widgets.\n\n` +
      `Prerequisites: If the action requires a focused element, provide selector to focus it first.\n\n` +
      `Params: { key, modifiers?, selector? } — key uses KeyboardEvent.key names like 'Enter','Tab','Escape','ArrowDown'. modifiers is array of ['ctrl','shift','alt','meta']. Example: { key:'Enter' }.\n\n` +
      `Returns: { success, currentUrl, pageTitle } — keyboard presses often cause navigation or UI changes; re-ground using currentUrl/pageTitle.\n\n` +
      `Common failures and recovery: If key has no effect, verify that the page listens to keyboard events on the element you focused; try focusing a specific input or container via clickElement or executeScript to set focus.`,
  ),
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
  description: makeDesc(
    `Purpose: Scroll the active scrollable container or the window. Designed for SPAs where the main scrollable element is an overflow container.\n\n` +
      `When to use: Use for pagination/infinite scroll feeds or to reveal elements that lazy-load when scrolled into view.\n\n` +
      `Prerequisites: For deterministic behavior, prefer toSelector or toPercent over raw amount when targeting a specific element or position.\n\n` +
      `Params: { direction?, amount?, toSelector?, toPercent? } — direction in ['up','down','left','right']; amount is pixels; toSelector scrolls element into center; toPercent is 0-100 of scrollable height. Example: { toPercent: 80 } to jump near the bottom.\n\n` +
      `Returns: { success, scrollY, pageScrollHeight, viewportHeight, scrollPercent, container, atBottom } — use scrollPercent and atBottom to detect progress and stop conditions.\n\n` +
      `Common failures and recovery: If scrollPercent stays 0 on repeated calls, the page may not expose a scrollable container; call getPageStructure or executeScript('getDocumentMeta') to re-ground and then try to find a scroll container via executeScript(queryAll, 'selector').`,
  ),
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
  description: makeDesc(
    `Purpose: Simulate mouse hover over an element to reveal menus/tooltips or trigger CSS :hover behaviors.\n\n` +
      `When to use: Use before clickElement when a control is only visible on hover (dropdowns, preview popups).\n\n` +
      `Prerequisites: Provide a selector for the element to hover.\n\n` +
      `Params: { selector } — example: { selector: '.menu-toggle' }.\n\n` +
      `Returns: { success, currentUrl, pageTitle }.\n\n` +
      `Common failures and recovery: If hover does not reveal the expected content, try a short delay (200–400ms) then call getPageStructure to find newly visible elements.`,
  ),
  inputSchema: z.object({ selector: z.string().describe("CSS selector of the element to hover over") }),
  execute: async (args) => sendToBackground("HOVER_ELEMENT", args),
});

const selectOption = tool({
  description: makeDesc(
    `Purpose: Choose an option from a native <select> element by visible label or by value attribute.\n\n` +
      `When to use: Choose dropdown options in standard HTML select controls. For custom dropdown widgets implemented with divs, use clickElement or executeScript.\n\n` +
      `Prerequisites: Provide selector for the <select>.\n\n` +
      `Params: { selector, label?, value? } — supply either label or value to match. Example: { selector:'#country', value:'US' }.\n\n` +
      `Returns: { success, selectedValue } — verify selectedValue equals expected value.\n\n` +
      `Common failures and recovery: If selectOption fails, call getElementInfo(selector) to confirm it is an HTMLSelectElement; for custom selects, inspect the markup with getPageStructure or queryAll via executeScript.`,
  ),
  inputSchema: z.object({
    selector: z.string().describe("CSS selector of the <select> element"),
    label: z.string().optional().describe("Visible text of the option to pick"),
    value: z.string().optional().describe("Value attribute of the option to pick"),
  }),
  execute: async (args) => sendToBackground("SELECT_OPTION", args),
});

const fillForm = tool({
  description: makeDesc(
    `Purpose: Fill many form fields in one operation and optionally submit.\n\n` +
      `When to use: Completing structured forms (signup, checkout) where you can provide an explicit mapping of selectors to values. For single-field edits, prefer typeText.\n\n` +
      `Prerequisites: Ensure fields are visible or call waitForElement for the first field.\n\n` +
      `Params: { fields: [{selector, value, type?}], submitSelector? } — type may be 'input','textarea','select','checkbox','radio'. Example: fields:[{selector:'#name',value:'Alice'},{selector:'#agree',value:'true',type:'checkbox'}], submitSelector:'#submit'.\n\n` +
      `Returns: { success, filledCount, errors } — errors is an array of not-found selectors; use it to recover by calling getPageStructure to find correct selectors.\n\n` +
      `Common failures and recovery: If some selectors fail, retry with corrected selectors from getPageStructure or use getElementInfo to diagnose unusual inputs.`,
  ),
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
  description: makeDesc(
    `Purpose: Return a concise list of interactive elements (links, buttons, inputs) to help choose selectors.\n\n` +
      `When to use: When you need to discover click targets or fields for typing/filling. Use this before clickElement when selectors are unknown.\n\n` +
      `Prerequisites: None.\n\n` +
      `Params: { filter? } — 'interactive' (default), 'inputs', 'links', 'buttons', or 'all'.\n\n` +
      `Returns: { elements, totalFound, showing, truncated, hint } — elements is an array of {tag, selector, label, type, role}. totalFound helps you know if the result is truncated (showing <=30). If truncated=true, refine your query with a container selector via executeScript queryAll or use extractData with containerSelector.\n\n` +
      `Common failures and recovery: If selectors look unstable (auto-generated ids), prefer class-based selectors or relative selectors (parent > child) discovered via getElementInfo.`,
  ),
  inputSchema: z.object({
    filter: z
      .enum(["all", "interactive", "inputs", "links", "buttons"])
      .optional()
      .default("interactive"),
  }),
  execute: async (args) => sendToBackground("GET_PAGE_STRUCTURE", args),
});

const getElementInfo = tool({
  description: makeDesc(
    `Purpose: Inspect a single element's details: text, attributes, bounding rect, computed styles, and visibility.\n\n` +
      `When to use: Use when you have a selector and need to confirm the element's existence, visibility, or to compute a robust selector.\n\n` +
      `Prerequisites: Provide a selector.\n\n` +
      `Params: { selector } — example: { selector: '#price' }.\n\n` +
      `Returns: { tag, text, attributes, rect, visible, computedStyles } — use rect to decide if the element is offscreen and whether a scroll is required. computedStyles helps diagnose display:none or visibility issues.\n\n` +
      `Common failures and recovery: If element not found, call getPageStructure with a wider filter and consider using queryAll via executeScript to locate elements by partial text.`,
  ),
  inputSchema: z.object({ selector: z.string().describe("CSS selector of the element") }),
  execute: async (args) => sendToBackground("GET_ELEMENT_INFO", args),
});

const getPageLinks = tool({
  description: makeDesc(
    `Purpose: Extract anchor links from the page for navigation or link selection tasks.\n\n` +
      `When to use: When you want to enumerate possible navigation targets (internal site links, search results).\n\n` +
      `Prerequisites: None.\n\n` +
      `Params: { internalOnly?, limit? } — internalOnly=true limits to same-origin links. limit controls max number returned.\n\n` +
      `Returns: { links } where each item is { href, text, internal }. Use href to navigate and text to choose a link by label.\n\n` +
      `Common failures and recovery: If links are generated by JS after load, call waitForElement or scrollPage to trigger lazy injection before extracting links.`,
  ),
  inputSchema: z.object({
    internalOnly: z.boolean().optional().default(false),
    limit: z.number().optional().default(50),
  }),
  execute: async (args) => sendToBackground("GET_PAGE_LINKS", args),
});

const waitForElement = tool({
  description: makeDesc(
    `Purpose: Block until a CSS selector is present (and optionally visible) or timeout occurs.\n\n` +
      `When to use: After navigation or after interactions that load new content (click, submit). Prefer this over naive time delays.\n\n` +
      `Prerequisites: Provide a selector that reliably indicates page readiness (e.g. '#results', '.search-list').\n\n` +
      `Params: { selector, timeout?, visible? } — timeout in ms. Example: { selector: '.results', timeout: 10000 }.\n\n` +
      `Returns: { found: boolean, elapsed } — if found=false, you should either retry with a longer timeout, verify currentUrl via getPageContent, or call getPageStructure to troubleshoot.\n\n` +
      `Common failures and recovery: If not found and pageTitle/url mismatch expectation, call navigateTo or getPageContent before retrying.`,
  ),
  inputSchema: z.object({
    selector: z.string().describe("CSS selector to wait for"),
    timeout: z.number().optional().default(5000),
    visible: z.boolean().optional().default(true),
  }),
  execute: async (args) => sendToBackground("WAIT_FOR_ELEMENT", args),
});

const extractData = tool({
  description: makeDesc(
    `Purpose: Extract structured repeated items (products, results) from a page using a plain-English description and optional container selector.\n\n` +
      `When to use: Scraping tables, search results, product lists where you want N repeated entries. Prefer this to manual queryAll calls.\n\n` +
      `Prerequisites: If the list loads dynamically, use waitForElement or scrollPage to ensure items are present.\n\n` +
      `Params: { description, containerSelector?, limit? } — describe the fields you want in plain English, e.g. "product name, price, and product URL". Example: { description:'name and price', containerSelector:'.results', limit:20 }.\n\n` +
      `Returns: { items, count, hint } — items contain {text, html} snippets for each candidate. Use these as inputs to further extraction (getElementInfo or executeScript queryAll) when you need precise selectors.\n\n` +
      `Common failures and recovery: If items contain unrelated content, refine the containerSelector or use executeScript('queryAll') to get stricter element lists.`,
  ),
  inputSchema: z.object({
    description: z.string().describe("Plain-English description of what to extract"),
    containerSelector: z.string().optional().describe("CSS selector to scope the extraction"),
    limit: z.number().optional().default(20),
  }),
  execute: async (args) => sendToBackground("EXTRACT_DATA", args),
});

// EXECUTE_SCRIPT: low-level operations
const executeScript = tool({
  description: makeDesc(
    `Purpose: Low-level, precompiled DOM operations for cases where higher-level tools cannot accomplish a task.\n\n` +
      `When to use: Only when other tools cannot. This is the escape hatch for DOM reads/writes and for custom queries. Avoid eval or arbitrary JS strings; use the supported operations.\n\n` +
      `Prerequisites: Know the selector and the operation you need. Many operations require a selector or property/attribute name.\n\n` +
      `Params: { operation, selector?, attribute?, property?, value?, eventName?, eventDetail? } — see the list below for required params per operation.\n\n` +
      `Supported operations and returns: getAttribute -> { result:string }, setAttribute -> { result:true }, removeAttribute -> { result:true }, getProperty -> { result:string }, setProperty -> { result:true }, getComputedStyle -> { result:string }, dispatchEvent -> { result:true }, removeElement -> { result:true }, getOuterHTML -> { result:string }, setInnerHTML -> { result:true }, queryAll -> { result:[{tag,text,id}] }, getDocumentMeta -> { result:{title,url,description,h1}}.\n\n` +
      `Common failures and recovery: If you receive an "selector required" error, call getPageStructure to discover selectors. If setInnerHTML is needed, remember script tags are stripped by the runtime for safety.`,
  ),
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
  };

const { getScreenshot: _gs, ...toolsWithoutScreenshot } = agentTools;

export function getToolsForModel(vision: boolean) {
  return vision ? agentTools : toolsWithoutScreenshot;
}
