const PANEL_PATH = "sidepanel.html";

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
chrome.sidePanel.setOptions({ path: PANEL_PATH, enabled: false });

let activeIntronGroupId: number | null = null;

async function ensureIntronGroup(tab: chrome.tabs.Tab): Promise<number> {
  // Already in an Intron group — keep it
  if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
    try {
      const group = await chrome.tabGroups.get(tab.groupId);
      if (group.title === "Intron") return group.id;
    } catch {
      /* group deleted */
    }
  }
  // Always create a new group — each session gets its own Intron group (1 tab each)
  const groupId = await chrome.tabs.group({
    tabIds: tab.id!,
    createProperties: { windowId: tab.windowId },
  });
  await chrome.tabGroups.update(groupId, {
    title: "Intron",
    color: "cyan",
    collapsed: false,
  });
  return groupId;
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url || tab.url.startsWith("chrome://")) return;
  try {
    // Fire-and-forget setOptions (no await) — keeps open() in gesture context
    chrome.sidePanel.setOptions({ tabId: tab.id, path: PANEL_PATH, enabled: true });
    // First await MUST be open() — Chrome requires user gesture on first async boundary
    await chrome.sidePanel.open({ tabId: tab.id });
    activeIntronGroupId = await ensureIntronGroup(tab);
  } catch (err) {
    console.error("[Intron] Failed to open sidepanel:", err);
  }
});

// ─── Tab State Cache ──────────────────────────────────────────────────────────

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

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    cacheTabState(tabId, tab.url || null);
  }
  // Track group membership changes — enable/disable sidepanel accordingly
  if ("groupId" in changeInfo) {
    if (changeInfo.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
      // Tab left its group — disable sidepanel
      await chrome.sidePanel.setOptions({
        tabId,
        path: PANEL_PATH,
        enabled: false,
      });
    } else {
      // Tab joined a group — check if it's the Intron group
      try {
        const group = await chrome.tabGroups.get(changeInfo.groupId!);
        if (group.title === "Intron") {
          await chrome.sidePanel.setOptions({
            tabId,
            path: PANEL_PATH,
            enabled: true,
          });
        }
      } catch {
        // Group may have been deleted between events
      }
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabStateCache.delete(tabId);
  chrome.storage.session.remove([`tab_${tabId}`]);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  if (!tab?.id) throw new Error("No active tab found");
  return tab;
}

async function getIntronTab(): Promise<chrome.tabs.Tab | null> {
  if (activeIntronGroupId === null) return null;
  try {
    const tabs = await chrome.tabs.query({ groupId: activeIntronGroupId });
    return tabs[0] ?? null;
  } catch {
    activeIntronGroupId = null;
    return null;
  }
}

function injectScript<T>(
  tabId: number,
  func: (...args: any[]) => T,
  args?: any[],
): Promise<T> {
  return chrome.scripting
    .executeScript({
      target: { tabId },
      world: "ISOLATED",
      func,
      args: (args ?? []).map((a) => (a === undefined ? null : a)),
    })
    .then(([r]) => r.result as T);
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

const handlers: Record<string, (payload: any) => Promise<any>> = {
  async CAPTURE_SCREENSHOT() {
    const dataUrl = await chrome.tabs.captureVisibleTab({ format: "png" });
    return { dataUrl };
  },

  async GET_PAGE_CONTENT() {
    const tab = await getActiveTab();
    return injectScript(tab.id!, () => ({
      title: document.title,
      url: location.href,
      text: document.body?.innerText?.slice(0, 15_000) ?? "",
      metaDescription:
        document.querySelector<HTMLMetaElement>('meta[name="description"]')
          ?.content ?? "",
    }));
  },

  async NAVIGATE_TO({ url }: { url: string }) {
    const tab = (await getIntronTab()) ?? (await getActiveTab());
    await chrome.tabs.update(tab.id!, { url });
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, 10_000);
      function listener(updatedTabId: number, info: { status?: string }) {
        if (updatedTabId === tab.id && info.status === "complete") {
          clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      }
      chrome.tabs.onUpdated.addListener(listener);
    });
    const updated = await chrome.tabs.get(tab.id!);
    return { success: true, finalUrl: updated.url ?? url };
  },

  async GO_BACK() {
    const tab = await getActiveTab();
    await chrome.tabs.goBack(tab.id!);
    return { success: true };
  },

  async GO_FORWARD() {
    const tab = await getActiveTab();
    await chrome.tabs.goForward(tab.id!);
    return { success: true };
  },

  async RELOAD_PAGE() {
    const tab = await getActiveTab();
    await chrome.tabs.reload(tab.id!);
    return { success: true };
  },

  async CLICK_ELEMENT({
    selector,
    text,
    nth = 0,
  }: {
    selector?: string;
    text?: string;
    nth?: number;
  }) {
    const tab = await getActiveTab();
    return injectScript(
      tab.id!,
      (sel: string | undefined, txt: string | undefined, n: number) => {
        let el: Element | null = null;
        if (sel) {
          el = document.querySelectorAll(sel)[n] ?? null;
        } else if (txt) {
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_ELEMENT,
          );
          let count = 0;
          while (walker.nextNode()) {
            const node = walker.currentNode as Element;
            if (node.textContent?.trim() === txt) {
              if (count === n) {
                el = node;
                break;
              }
              count++;
            }
          }
        }
        if (!el)
          return {
            success: false,
            message: `Element not found: ${sel ?? txt}`,
          };
        (el as HTMLElement).focus();
        (el as HTMLElement).click();
        return {
          success: true,
          message: `Clicked <${el.tagName.toLowerCase()}>`,
        };
      },
      [selector, text, nth],
    );
  },

  async TYPE_TEXT({
    text,
    selector,
    clearFirst = false,
  }: {
    text: string;
    selector?: string;
    clearFirst?: boolean;
  }) {
    const tab = await getActiveTab();
    return injectScript(
      tab.id!,
      (sel: string | undefined, txt: string, clear: boolean) => {
        const el = sel
          ? document.querySelector<HTMLElement>(sel)
          : (document.activeElement as HTMLElement);
        if (!el) return { success: false, message: "No target element found" };
        el.focus();
        const isInput = el instanceof HTMLInputElement;
        const isTextarea = el instanceof HTMLTextAreaElement;
        if (isInput || isTextarea) {
          const nativeSetter = Object.getOwnPropertyDescriptor(
            isInput
              ? HTMLInputElement.prototype
              : HTMLTextAreaElement.prototype,
            "value",
          )?.set;
          const newValue = clear ? txt : (el as HTMLInputElement).value + txt;
          nativeSetter?.call(el, newValue);
        } else {
          if (clear) el.textContent = txt;
          else el.textContent = (el.textContent ?? "") + txt;
        }
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return { success: true, message: `Typed ${txt.length} characters` };
      },
      [selector, text, clearFirst],
    );
  },

  async PRESS_KEY({
    key,
    modifiers = [],
    selector,
  }: {
    key: string;
    modifiers?: string[];
    selector?: string;
  }) {
    const tab = await getActiveTab();
    await injectScript(
      tab.id!,
      (sel: string | undefined, k: string, mods: string[]) => {
        const target = sel
          ? document.querySelector<HTMLElement>(sel)
          : (document.activeElement as HTMLElement);
        if (sel && target) target.focus();
        const init: KeyboardEventInit = {
          key: k,
          bubbles: true,
          cancelable: true,
          ctrlKey: mods.includes("ctrl"),
          shiftKey: mods.includes("shift"),
          altKey: mods.includes("alt"),
          metaKey: mods.includes("meta"),
        };
        const el = target ?? document.body;
        el.dispatchEvent(new KeyboardEvent("keydown", init));
        el.dispatchEvent(new KeyboardEvent("keypress", init));
        el.dispatchEvent(new KeyboardEvent("keyup", init));
      },
      [selector, key, modifiers],
    );
    return { success: true };
  },

  async SCROLL_PAGE({
    direction = "down",
    amount = 400,
    toSelector,
    toPercent,
  }: {
    direction?: string;
    amount?: number;
    toSelector?: string;
    toPercent?: number;
  }) {
    const tab = await getActiveTab();

    // MUST use world: "MAIN" for scrolling.
    //
    // Reason: `overflow: scroll` containers in SPAs (X.com, Gmail, etc.) are
    // managed by the page's own JS framework. In the ISOLATED world, we share
    // the DOM but NOT the live JavaScript objects — so getBoundingClientRect()
    // and scrollTop reads/writes are correct, but scroll event listeners
    // registered by the page (e.g. React virtual list observers) won't fire
    // if we call el.scrollBy() from ISOLATED world on some browsers.
    //
    // MAIN world ensures our scrollBy() triggers the same event path as a real
    // user scroll wheel event, including IntersectionObserver callbacks that
    // infinite-scroll feeds (X.com, LinkedIn, etc.) depend on.
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id! },
      world: "MAIN",
      func: (
        dir: string,
        amt: number,
        toSel: string | null,
        toPct: number | null,
      ) => {
        // ── 1. scrollIntoView shortcut ──────────────────────────────────────
        if (toSel) {
          document
            .querySelector(toSel)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
          return {
            success: true,
            scrollY: window.scrollY,
            container: "scrollIntoView",
          };
        }

        // ── 2. Find the real scrollable container ───────────────────────────
        //
        // The core problem: modern SPAs never scroll `window`. They use a deep
        // overflow div. `window.scrollY` stays 0 forever on X.com, Gmail,
        // Notion, Linear etc. We need to find THE element that is actually
        // doing the scrolling.
        //
        // Strategy (ordered by cheapness):
        //   A. Walk ancestors of document.activeElement (O(depth) — very fast)
        //   B. Walk ancestors of the element under the viewport center (O(depth))
        //   C. Full DOM scan → pick largest scrollable delta (O(n) — fallback)
        //   D. window — last resort for plain documents

        const isVertical = dir === "up" || dir === "down";

        function isScrollable(el: Element): boolean {
          const style = window.getComputedStyle(el);
          const overflow = isVertical ? style.overflowY : style.overflowX;
          if (overflow !== "auto" && overflow !== "scroll") return false;
          const scrollDelta = isVertical
            ? el.scrollHeight - el.clientHeight
            : el.scrollWidth - el.clientWidth;
          return scrollDelta > 1;
        }

        function walkUp(start: Element | null): Element | null {
          let node = start;
          while (node && node !== document.documentElement) {
            if (isScrollable(node)) return node;
            node = node.parentElement;
          }
          return null;
        }

        // Strategy A — walk from active element
        let container: Element | null = walkUp(document.activeElement);

        // Strategy B — walk from element at viewport center
        if (!container) {
          const cx = window.innerWidth / 2;
          const cy = window.innerHeight / 2;
          const hit = document.elementFromPoint(cx, cy);
          container = walkUp(hit);
        }

        // Strategy C — full DOM scan, pick largest scrollable area
        if (!container) {
          let bestDelta = 0;
          for (const el of Array.from(document.querySelectorAll("*"))) {
            if (!isScrollable(el)) continue;
            const delta = isVertical
              ? el.scrollHeight - el.clientHeight
              : el.scrollWidth - el.clientWidth;
            if (delta > bestDelta) {
              bestDelta = delta;
              container = el;
            }
          }
        }

        // ── 3. Scroll it ────────────────────────────────────────────────────
        const delta = dir === "up" || dir === "left" ? -amt : amt;

        if (container) {
          if (toPct !== null) {
            const target =
              ((container.scrollHeight - container.clientHeight) * toPct) / 100;
            container.scrollTo({ top: target, behavior: "smooth" });
          } else if (isVertical) {
            container.scrollBy({ top: delta, behavior: "smooth" });
          } else {
            container.scrollBy({ left: delta, behavior: "smooth" });
          }
          return {
            success: true,
            scrollY: container.scrollTop,
            container:
              container.tagName + (container.id ? `#${container.id}` : ""),
          };
        }

        // Strategy D — window fallback (plain documents, MDN, Wikipedia, etc.)
        if (toPct !== null) {
          const maxScroll =
            document.documentElement.scrollHeight - window.innerHeight;
          window.scrollTo({
            top: (maxScroll * toPct) / 100,
            behavior: "smooth",
          });
        } else if (isVertical) {
          window.scrollBy({ top: delta, behavior: "smooth" });
        } else {
          window.scrollBy({ left: delta, behavior: "smooth" });
        }
        return { success: true, scrollY: window.scrollY, container: "window" };
      },
      args: [direction, amount, toSelector ?? null, toPercent ?? null],
    });

    return result.result;
  },

  async HOVER_ELEMENT({ selector }: { selector: string }) {
    const tab = await getActiveTab();
    await injectScript(
      tab.id!,
      (sel: string) => {
        const el = document.querySelector<HTMLElement>(sel);
        if (!el) return;
        el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
        el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      },
      [selector],
    );
    return { success: true };
  },

  async SELECT_OPTION({
    selector,
    label,
    value,
  }: {
    selector: string;
    label?: string;
    value?: string;
  }) {
    const tab = await getActiveTab();
    return injectScript(
      tab.id!,
      (sel: string, lbl: string | undefined, val: string | undefined) => {
        const el = document.querySelector<HTMLSelectElement>(sel);
        if (!el) return { success: false, selectedValue: "" };
        for (const option of Array.from(el.options)) {
          if ((val && option.value === val) || (lbl && option.text === lbl)) {
            el.value = option.value;
            el.dispatchEvent(new Event("change", { bubbles: true }));
            return { success: true, selectedValue: option.value };
          }
        }
        return { success: false, selectedValue: "" };
      },
      [selector, label, value],
    );
  },

  async FILL_FORM({
    fields,
    submitSelector,
  }: {
    fields: Array<{ selector: string; value: string; type?: string }>;
    submitSelector?: string;
  }) {
    const tab = await getActiveTab();
    return injectScript(
      tab.id!,
      (
        flds: Array<{ selector: string; value: string; type?: string }>,
        submitSel?: string,
      ) => {
        let filledCount = 0;
        const errors: string[] = [];
        for (const f of flds) {
          const el = document.querySelector<HTMLElement>(f.selector);
          if (!el) {
            errors.push(`Not found: ${f.selector}`);
            continue;
          }
          if (f.type === "checkbox" || f.type === "radio") {
            (el as HTMLInputElement).checked = f.value === "true";
          } else if (f.type === "select") {
            (el as HTMLSelectElement).value = f.value;
          } else {
            const proto =
              el instanceof HTMLTextAreaElement
                ? HTMLTextAreaElement.prototype
                : HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
            if (setter) setter.call(el, f.value);
            else (el as HTMLInputElement).value = f.value;
          }
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          filledCount++;
        }
        if (submitSel) document.querySelector<HTMLElement>(submitSel)?.click();
        return { success: errors.length === 0, filledCount, errors };
      },
      [fields, submitSelector],
    );
  },

  async GET_PAGE_STRUCTURE({ filter = "interactive" }: { filter?: string }) {
    const tab = await getActiveTab();
    return injectScript(
      tab.id!,
      (f: string) => {
        const selectors: Record<string, string> = {
          interactive:
            'a, button, input, select, textarea, [role="button"], [onclick], [tabindex]',
          inputs: "input, select, textarea",
          links: "a[href]",
          buttons:
            'button, [role="button"], input[type="submit"], input[type="button"]',
          all: "*",
        };
        const query = selectors[f] ?? selectors.interactive;
        return {
          elements: Array.from(document.querySelectorAll(query))
            .slice(0, 30)
            .map((el) => {
              const tag = el.tagName.toLowerCase();
              const label =
                (el as HTMLElement).innerText?.trim().slice(0, 80) ||
                el.getAttribute("aria-label") ||
                el.getAttribute("placeholder") ||
                el.getAttribute("name") ||
                el.getAttribute("id") ||
                tag;
              const id = el.id ? "#" + CSS.escape(el.id) : null;
              const cls = el.classList.length
                ? "." + Array.from(el.classList).map(CSS.escape).join(".")
                : null;
              return {
                tag,
                selector: id ?? cls ?? tag,
                label,
                type: (el as HTMLInputElement).type,
                role: el.getAttribute("role") ?? undefined,
              };
            }),
        };
      },
      [filter],
    );
  },

  async GET_ELEMENT_INFO({ selector }: { selector: string }) {
    const tab = await getActiveTab();
    return injectScript(
      tab.id!,
      (sel: string) => {
        const el = document.querySelector<HTMLElement>(sel);
        if (!el) throw new Error(`Element not found: ${sel}`);
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        const attrs: Record<string, string> = {};
        for (const attr of Array.from(el.attributes))
          attrs[attr.name] = attr.value;
        return {
          tag: el.tagName.toLowerCase(),
          text: el.innerText?.slice(0, 500) ?? "",
          attributes: attrs,
          rect: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          },
          visible:
            rect.width > 0 && rect.height > 0 && style.display !== "none",
          computedStyles: {
            display: style.display,
            visibility: style.visibility,
            color: style.color,
            backgroundColor: style.backgroundColor,
            fontSize: style.fontSize,
          },
        };
      },
      [selector],
    );
  },

  async GET_PAGE_LINKS({
    internalOnly = false,
    limit = 50,
  }: {
    internalOnly?: boolean;
    limit?: number;
  }) {
    const tab = await getActiveTab();
    return injectScript(
      tab.id!,
      (internal: boolean, lim: number) => {
        const origin = location.origin;
        return {
          links: Array.from(
            document.querySelectorAll<HTMLAnchorElement>("a[href]"),
          )
            .map((a) => ({
              href: a.href,
              text: a.innerText.trim().slice(0, 100),
              internal: a.href.startsWith(origin),
            }))
            .filter((l) => !internal || l.internal)
            .slice(0, lim),
        };
      },
      [internalOnly, limit],
    );
  },

  async WAIT_FOR_ELEMENT({
    selector,
    timeout = 5000,
    visible = true,
  }: {
    selector: string;
    timeout?: number;
    visible?: boolean;
  }) {
    const tab = await getActiveTab();
    return injectScript(
      tab.id!,
      (sel: string, ms: number, needsVisible: boolean) => {
        return new Promise<{ found: boolean; elapsed: number }>((resolve) => {
          const start = Date.now();
          const check = () => {
            const el = document.querySelector<HTMLElement>(sel);
            const ok =
              el &&
              (!needsVisible || (el.offsetWidth > 0 && el.offsetHeight > 0));
            if (ok)
              return resolve({ found: true, elapsed: Date.now() - start });
            if (Date.now() - start >= ms)
              return resolve({ found: false, elapsed: ms });
            requestAnimationFrame(check);
          };
          check();
        });
      },
      [selector, timeout, visible],
    );
  },

  async EXTRACT_DATA({
    description,
    containerSelector,
    limit = 20,
  }: {
    description: string;
    containerSelector?: string;
    limit?: number;
  }) {
    const tab = await getActiveTab();
    return injectScript(
      tab.id!,
      (desc: string, contSel: string | undefined, lim: number) => {
        const root = contSel
          ? (document.querySelector(contSel) ?? document.body)
          : document.body;
        const candidates = Array.from(
          root.querySelectorAll(
            'li, tr, article, [class*="card"], [class*="item"], [class*="result"]',
          ),
        );
        const items = candidates.slice(0, lim).map((el) => ({
          text: (el as HTMLElement).innerText?.trim().slice(0, 300),
          html: el.innerHTML?.slice(0, 500),
        }));
        return { items, count: items.length, hint: desc };
      },
      [description, containerSelector, limit],
    );
  },

  // EXECUTE_SCRIPT — eval-free DOM escape hatch
  //
  // WHY NO eval():
  // Chrome enforces the extension's own manifest CSP in every world, including
  // ISOLATED. The Web Store also rejects any manifest with `unsafe-eval`.
  // There is no world-switch that makes eval() legal in an extension context.
  //
  // SOLUTION — pre-compiled parameterized operations:
  // Every real "escape hatch" use case (read/write attributes, dispatch events,
  // read computed styles, manipulate the DOM) can be expressed as a typed
  // operation + selector + value. We never need to eval a string to do any of
  // these. The func passed to executeScript is compiled at build time by the
  // bundler — only the *arguments* (selector, value, etc.) are dynamic.
  async EXECUTE_SCRIPT({
    operation,
    selector,
    property,
    value,
    eventName,
    eventDetail,
    attribute,
  }: {
    // Which pre-built operation to run
    operation:
      | "getAttribute" // read an attribute
      | "setAttribute" // write an attribute
      | "removeAttribute" // delete an attribute
      | "getProperty" // read an element JS property (e.g. value, checked, scrollTop)
      | "setProperty" // write an element JS property
      | "getComputedStyle" // read a CSS property via getComputedStyle
      | "dispatchEvent" // fire a CustomEvent on an element
      | "removeElement" // remove an element from the DOM
      | "getOuterHTML" // read outerHTML of an element
      | "setInnerHTML" // overwrite innerHTML (sanitised — no script tags)
      | "queryAll" // querySelectorAll → array of {tag, text, selector}
      | "getDocumentMeta"; // read title + URL + meta description of the page
    selector?: string;
    attribute?: string;
    property?: string;
    value?: string;
    eventName?: string;
    eventDetail?: Record<string, unknown>;
  }) {
    const tab = await getActiveTab();
    return injectScript(
      tab.id!,
      (
        op: string,
        sel: string | undefined,
        attr: string | undefined,
        prop: string | undefined,
        val: string | undefined,
        evtName: string | undefined,
        evtDetail: Record<string, unknown> | undefined,
      ) => {
        const el = sel ? document.querySelector<HTMLElement>(sel) : null;

        switch (op) {
          case "getAttribute": {
            if (!el || !attr)
              return { error: "selector and attribute required" };
            return { result: el.getAttribute(attr) };
          }
          case "setAttribute": {
            if (!el || !attr || val === undefined)
              return { error: "selector, attribute, value required" };
            el.setAttribute(attr, val);
            return { result: true };
          }
          case "removeAttribute": {
            if (!el || !attr)
              return { error: "selector and attribute required" };
            el.removeAttribute(attr);
            return { result: true };
          }
          case "getProperty": {
            if (!el || !prop)
              return { error: "selector and property required" };
            return {
              result: String(
                (el as unknown as Record<string, unknown>)[prop] ?? "",
              ),
            };
          }
          case "setProperty": {
            if (!el || !prop || val === undefined)
              return { error: "selector, property, value required" };
            (el as unknown as Record<string, unknown>)[prop] = val;
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
            return { result: true };
          }
          case "getComputedStyle": {
            if (!el || !prop)
              return { error: "selector and property required" };
            return {
              result: window.getComputedStyle(el).getPropertyValue(prop),
            };
          }
          case "dispatchEvent": {
            if (!el || !evtName)
              return { error: "selector and eventName required" };
            el.dispatchEvent(
              new CustomEvent(evtName, {
                detail: evtDetail ?? {},
                bubbles: true,
              }),
            );
            return { result: true };
          }
          case "removeElement": {
            if (!el) return { error: `Element not found: ${sel}` };
            el.remove();
            return { result: true };
          }
          case "getOuterHTML": {
            if (!el) return { error: `Element not found: ${sel}` };
            return { result: el.outerHTML.slice(0, 5000) };
          }
          case "setInnerHTML": {
            if (!el || val === undefined)
              return { error: "selector and value required" };
            // Strip <script> tags before writing — no arbitrary JS execution
            const sanitised = val.replace(/<script[\s\S]*?<\/script>/gi, "");
            el.innerHTML = sanitised;
            return { result: true };
          }
          case "queryAll": {
            if (!sel) return { error: "selector required" };
            const nodes = Array.from(
              document.querySelectorAll<HTMLElement>(sel),
            ).slice(0, 50);
            return {
              result: nodes.map((n) => ({
                tag: n.tagName.toLowerCase(),
                text: n.innerText?.trim().slice(0, 200),
                id: n.id || undefined,
              })),
            };
          }
          case "getDocumentMeta": {
            return {
              result: {
                title: document.title,
                url: location.href,
                description:
                  document.querySelector<HTMLMetaElement>(
                    'meta[name="description"]',
                  )?.content ?? "",
                h1: document.querySelector("h1")?.innerText?.trim() ?? "",
              },
            };
          }
          default:
            return { error: `Unknown operation: ${op}` };
        }
      },
      [operation, selector, attribute, property, value, eventName, eventDetail],
    );
  },

  async GET_TABS_LIST() {
    const tab = await getActiveTab();
    return {
      tabs: [
        {
          id: tab.id!,
          title: tab.title ?? "",
          url: tab.url ?? "",
          active: true,
          favIconUrl: tab.favIconUrl,
        },
      ],
    };
  },

  async OPEN_TAB({ url, active = true }: { url?: string; active?: boolean }) {
    const tab = await chrome.tabs.create({ url, active });
    return { tabId: tab.id!, url: tab.url ?? url ?? "" };
  },

  async SWITCH_TAB({ tabId }: { tabId: number }) {
    await chrome.tabs.update(tabId, { active: true });
    const tab = await chrome.tabs.get(tabId);
    await chrome.windows.update(tab.windowId, { focused: true });
    return { success: true };
  },

  async CLOSE_TAB({ tabId }: { tabId?: number }) {
    if (tabId) {
      await chrome.tabs.remove(tabId);
    } else {
      const tab = await getActiveTab();
      await chrome.tabs.remove(tab.id!);
    }
    return { success: true };
  },

  async FIND_OR_CREATE_INTRON_GROUP() {
    const tab = await getActiveTab();
    await chrome.sidePanel.setOptions({
      tabId: tab.id!,
      path: PANEL_PATH,
      enabled: true,
    });
    activeIntronGroupId = await ensureIntronGroup(tab);
    return { groupId: activeIntronGroupId, created: false };
  },

  async REMOVE_FROM_INTRON_GROUP({ tabId }: { tabId?: number }) {
    const tab = tabId ? await chrome.tabs.get(tabId) : await getActiveTab();
    if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
      await chrome.tabs.ungroup(tab.id!);
    }
    return { success: true };
  },
};

// ─── Message Router ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { type, ...payload } = message as {
    type: string;
    [k: string]: unknown;
  };
  const handler = handlers[type];
  if (!handler) return false;
  handler(payload)
    .then((result) => {
      sendResponse(result);
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Intron] ${type} → error:`, msg);
      sendResponse({ error: msg });
    });
  return true;
});
