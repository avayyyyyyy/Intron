declare namespace chrome.tabs {
  function captureTab(
    tabId: number,
    options?: { format?: string; quality?: number },
  ): Promise<string>;
}

const PANEL_PATH = "sidepanel.html";

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
chrome.sidePanel.setOptions({ path: PANEL_PATH, enabled: false });

const tabGroupMap = new Map<number, number>(); // tabId → groupId

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
  tabGroupMap.set(tab.id!, groupId);
  return groupId;
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url || tab.url.startsWith("chrome://")) return;
  try {
    // Fire-and-forget setOptions (no await) — keeps open() in gesture context
    chrome.sidePanel.setOptions({
      tabId: tab.id,
      path: `${PANEL_PATH}?tabId=${tab.id}`,
      enabled: true,
    });
    // First await MUST be open() — Chrome requires user gesture on first async boundary
    await chrome.sidePanel.open({ tabId: tab.id });
    await ensureIntronGroup(tab);
  } catch (err) {
    console.error("[Intron] Failed to open sidepanel:", err);
  }
});

// ─── Tab Lifecycle ───────────────────────────────────────────────────────────

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
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
            path: `${PANEL_PATH}?tabId=${tabId}`,
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
  tabGroupMap.delete(tabId);
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

async function getSourceTab(payload: {
  _sourceTabId?: number;
}): Promise<chrome.tabs.Tab> {
  if (payload._sourceTabId) {
    try {
      return await chrome.tabs.get(payload._sourceTabId);
    } catch {
      /* tab was closed */
    }
  }
  return getActiveTab();
}

async function getIntronTab(tabId?: number): Promise<chrome.tabs.Tab | null> {
  if (tabId === undefined) return null;
  const groupId = tabGroupMap.get(tabId);
  if (groupId === undefined) return null;
  try {
    const tabs = await chrome.tabs.query({ groupId });
    return tabs[0] ?? null;
  } catch {
    tabGroupMap.delete(tabId);
    return null;
  }
}

async function injectScript<T>(
  tabId: number,
  func: (...args: any[]) => T,
  args?: any[],
): Promise<T> {
  const [r] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "ISOLATED",
    func,
    args: (args ?? []).map((a) => (a === undefined ? null : a)),
  });
  return r.result as T;
}

function waitForTabLoad(tabId: number, timeoutMs = 10_000): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, timeoutMs);
    function listener(id: number, info: { status?: string }) {
      if (id === tabId && info.status === "complete") { clearTimeout(timer); chrome.tabs.onUpdated.removeListener(listener); resolve(); }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function navigateTab(tabId: number, action: () => Promise<void>): Promise<{ success: true; currentUrl: string; pageTitle: string }> {
  const loaded = waitForTabLoad(tabId);
  await action();
  await loaded;
  const updated = await chrome.tabs.get(tabId);
  return { success: true, currentUrl: updated.url ?? "", pageTitle: updated.title ?? "" };
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

const handlers: Record<string, (payload: any) => Promise<any>> = {
  async CAPTURE_SCREENSHOT({ _sourceTabId }: { _sourceTabId?: number }) {
    // captureVisibleTab captures whatever is visible in a window.
    // If we know the source tab, find its window and capture that.
    if (_sourceTabId) {
      try {
        const tab = await chrome.tabs.get(_sourceTabId);
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
          format: "png",
        });
        return { dataUrl };
      } catch {
        // Tab may not be visible — fall through to default
      }
    }
    const dataUrl = await chrome.tabs.captureVisibleTab({ format: "png" });
    return { dataUrl };
  },

  async GET_TAB_INFO(payload: { _sourceTabId?: number }) {
    const tab = await getSourceTab(payload);
    return { url: tab.url ?? "", title: tab.title ?? "" };
  },

  async GET_PAGE_CONTENT(payload: { _sourceTabId?: number }) {
    const tab = await getSourceTab(payload);
    return injectScript(tab.id!, () => ({
      title: document.title,
      url: location.href,
      text: document.body?.innerText?.slice(0, 15_000) ?? "",
      metaDescription:
        document.querySelector<HTMLMetaElement>('meta[name="description"]')
          ?.content ?? "",
    }));
  },

  async NAVIGATE_TO({ url, _sourceTabId }: { url: string; _sourceTabId?: number }) {
    const tab = (await getIntronTab(_sourceTabId)) ?? (await getSourceTab({ _sourceTabId }));
    // Listener attached BEFORE tabs.update to avoid race on cached pages
    const result = await navigateTab(tab.id!, () => chrome.tabs.update(tab.id!, { url }).then(() => {}));
    return { success: true, finalUrl: result.currentUrl || url, pageTitle: result.pageTitle };
  },

  async GO_BACK(payload: { _sourceTabId?: number }) {
    const tab = await getSourceTab(payload);
    return navigateTab(tab.id!, () => chrome.tabs.goBack(tab.id!));
  },

  async GO_FORWARD(payload: { _sourceTabId?: number }) {
    const tab = await getSourceTab(payload);
    return navigateTab(tab.id!, () => chrome.tabs.goForward(tab.id!));
  },

  async RELOAD_PAGE(payload: { _sourceTabId?: number }) {
    const tab = await getSourceTab(payload);
    return navigateTab(tab.id!, () => chrome.tabs.reload(tab.id!));
  },

  async CLICK_ELEMENT({
    selector,
    text,
    nth = 0,
    _sourceTabId,
  }: {
    selector?: string;
    text?: string;
    nth?: number;
    _sourceTabId?: number;
  }) {
    const tab = await getSourceTab({ _sourceTabId });
    return injectScript(
      tab.id!,
      (sel: string | undefined, txt: string | undefined, n: number) => {
        let el: Element | null = null;
        if (sel) {
          el = document.querySelectorAll(sel)[n] ?? null;
        } else if (txt) {
          // Single-pass text matching: collect own-text matches and full-text matches
          // simultaneously, preferring own-text (innermost) over full textContent.
          const ownTextMatches: Element[] = [];
          const fullTextMatches: Element[] = [];
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
          while (walker.nextNode()) {
            const node = walker.currentNode as Element;
            // Own text: direct text nodes only (no child element text)
            let ownText = "";
            for (let i = 0; i < node.childNodes.length; i++) {
              const c = node.childNodes[i];
              if (c.nodeType === Node.TEXT_NODE) {
                const t = c.textContent?.trim();
                if (t) ownText += (ownText ? " " : "") + t;
              }
            }
            if (ownText === txt) ownTextMatches.push(node);
            if (node.textContent?.trim() === txt) fullTextMatches.push(node);
          }
          if (ownTextMatches.length > n) {
            el = ownTextMatches[n];
          } else {
            fullTextMatches.sort((a, b) => (a.innerHTML?.length ?? 0) - (b.innerHTML?.length ?? 0));
            el = fullTextMatches[n] ?? null;
          }
        }
        if (!el)
          return {
            success: false,
            message: `Element not found: ${sel ?? txt}`,
          };

        const htmlEl = el as HTMLElement;

        const rect = htmlEl.getBoundingClientRect();
        const style = window.getComputedStyle(htmlEl);
        if (
          rect.width === 0 ||
          rect.height === 0 ||
          style.display === "none" ||
          style.visibility === "hidden"
        ) {
          return {
            success: false,
            message: `Element found but not visible: <${el.tagName.toLowerCase()}>`,
          };
        }

        if (
          rect.bottom < 0 ||
          rect.top > window.innerHeight ||
          rect.right < 0 ||
          rect.left > window.innerWidth
        ) {
          htmlEl.scrollIntoView({ block: "center", behavior: "instant" });
        }

        // Dispatch full pointer + mouse event sequence matching real browser behavior:
        // pointerdown → mousedown → [focus] → pointerup → mouseup → click
        // Modern component libraries (Material UI, Radix, drag libs) need PointerEvents.
        const center = htmlEl.getBoundingClientRect();
        const cx = center.left + center.width / 2;
        const cy = center.top + center.height / 2;
        const shared = {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: cx,
          clientY: cy,
          button: 0,
        };

        htmlEl.dispatchEvent(new PointerEvent("pointerdown", { ...shared, pointerId: 1, pointerType: "mouse" }));
        htmlEl.dispatchEvent(new MouseEvent("mousedown", shared));
        // Focus between mousedown and mouseup (matches real browser order)
        htmlEl.focus();
        htmlEl.dispatchEvent(new PointerEvent("pointerup", { ...shared, pointerId: 1, pointerType: "mouse" }));
        htmlEl.dispatchEvent(new MouseEvent("mouseup", shared));
        htmlEl.dispatchEvent(new MouseEvent("click", shared));

        return {
          success: true,
          message: `Clicked <${el.tagName.toLowerCase()}>`,
          currentUrl: location.href,
          pageTitle: document.title,
        };
      },
      [selector, text, nth],
    );
  },

  async TYPE_TEXT({
    text,
    selector,
    clearFirst = false,
    _sourceTabId,
  }: {
    text: string;
    selector?: string;
    clearFirst?: boolean;
    _sourceTabId?: number;
  }) {
    const tab = await getSourceTab({ _sourceTabId });
    return injectScript(
      tab.id!,
      (sel: string | undefined, txt: string, clear: boolean) => {
        const el = sel
          ? document.querySelector<HTMLElement>(sel)
          : (document.activeElement as HTMLElement);
        if (!el) return { success: false, message: "No target element found" };

        el.focus();
        el.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

        const isInput = el instanceof HTMLInputElement;
        const isTextarea = el instanceof HTMLTextAreaElement;

        // Input types that do NOT support setSelectionRange
        const noSelectionTypes = new Set([
          "number",
          "date",
          "month",
          "week",
          "time",
          "datetime-local",
          "color",
          "range",
          "hidden",
        ]);

        if (isInput || isTextarea) {
          if (clear) {
            (el as HTMLInputElement).select();
          } else {
            // Move cursor to end — but only for types that support setSelectionRange.
            // Calling it on type="number", "date", etc. throws a DOMException.
            const inputType = (
              (el as HTMLInputElement).type ?? "text"
            ).toLowerCase();
            if (!noSelectionTypes.has(inputType)) {
              try {
                const len = (el as HTMLInputElement).value.length;
                (el as HTMLInputElement).setSelectionRange(len, len);
              } catch {
                // Swallow — some exotic types or custom elements may still throw
              }
            }
          }

          // Use execCommand('insertText') — this fires a trusted InputEvent
          // with inputType 'insertText', which React, Angular, and Vue all
          // properly detect and sync with. It also preserves the undo stack.
          const inserted = document.execCommand("insertText", false, txt);

          // Re-focus after execCommand — some browsers/sites blur the element
          // during execCommand in the ISOLATED world. This is the root cause
          // of the "input loses focus after typing" bug.
          if (document.activeElement !== el) {
            el.focus();
          }

          if (!inserted) {
            // Fallback for rare cases where execCommand fails (e.g., some
            // custom web components). Use nativeSetter + synthetic events.
            const proto = isInput
              ? HTMLInputElement.prototype
              : HTMLTextAreaElement.prototype;
            const nativeSetter = Object.getOwnPropertyDescriptor(
              proto,
              "value",
            )?.set;
            const newValue = clear
              ? txt
              : (el as HTMLInputElement).value + txt;
            nativeSetter?.call(el, newValue);
            el.dispatchEvent(
              new InputEvent("input", {
                bubbles: true,
                cancelable: true,
                inputType: "insertText",
                data: txt,
              }),
            );
            el.dispatchEvent(new Event("change", { bubbles: true }));
          } else {
            // execCommand succeeded — still dispatch change for form validation
            // and auto-save listeners that only watch 'change', not 'input'.
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }
        } else {
          if (clear) {
            // Select all content then replace
            const range = document.createRange();
            range.selectNodeContents(el);
            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);
          } else {
            // Move cursor to end
            const selection = window.getSelection();
            selection?.selectAllChildren(el);
            selection?.collapseToEnd();
          }

          const inserted = document.execCommand("insertText", false, txt);

          if (document.activeElement !== el) {
            el.focus();
          }

          if (!inserted) {
            if (clear) el.textContent = txt;
            else el.textContent = (el.textContent ?? "") + txt;
            el.dispatchEvent(
              new InputEvent("input", {
                bubbles: true,
                cancelable: true,
                inputType: "insertText",
                data: txt,
              }),
            );
          }
        }

        return { success: true, message: `Typed ${txt.length} characters` };
      },
      [selector, text, clearFirst],
    );
  },

  async PRESS_KEY({
    key,
    modifiers = [],
    selector,
    _sourceTabId,
  }: {
    key: string;
    modifiers?: string[];
    selector?: string;
    _sourceTabId?: number;
  }) {
    const tab = await getSourceTab({ _sourceTabId });
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
    _sourceTabId,
  }: {
    direction?: string;
    amount?: number;
    toSelector?: string;
    toPercent?: number;
    _sourceTabId?: number;
  }) {
    const tab = await getSourceTab({ _sourceTabId });

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
        function scrollInfo(target: Element | null, label: string) {
          const st = target ? target.scrollTop : window.scrollY;
          const sh = target ? target.scrollHeight : document.documentElement.scrollHeight;
          const ch = target ? target.clientHeight : window.innerHeight;
          const max = sh - ch;
          return {
            success: true, scrollY: Math.round(st), scrollHeight: sh, viewportHeight: ch,
            scrollPercent: max > 0 ? Math.round((st / max) * 100) : 100,
            atTop: st <= 1, atBottom: st >= max - 1, container: label,
          };
        }

        const isVertical = dir === "up" || dir === "down";

        function isScrollable(el: Element): boolean {
          const style = window.getComputedStyle(el);
          const ov = isVertical ? style.overflowY : style.overflowX;
          if (ov !== "auto" && ov !== "scroll") return false;
          return (isVertical ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth) > 1;
        }

        function walkUp(start: Element | null): Element | null {
          let node = start;
          while (node && node !== document.documentElement) {
            if (isScrollable(node)) return node;
            node = node.parentElement;
          }
          return null;
        }

        function containerLabel(el: Element) { return el.tagName + (el.id ? `#${el.id}` : ""); }

        // ── 1. scrollIntoView shortcut ──
        if (toSel) {
          const target = document.querySelector(toSel);
          if (!target) return { success: false, error: `Element not found: ${toSel}` };
          target.scrollIntoView({ behavior: "instant", block: "center" });
          const ancestor = walkUp(target);
          return scrollInfo(ancestor, ancestor ? containerLabel(ancestor) : "window");
        }

        // ── 2. Find the real scrollable container ──

        let container: Element | null = walkUp(document.activeElement);
        if (!container) {
          container = walkUp(document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2));
        }
        if (!container) {
          let bestDelta = 0;
          for (const el of Array.from(document.querySelectorAll("*"))) {
            if (!isScrollable(el)) continue;
            const d = isVertical ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth;
            if (d > bestDelta) { bestDelta = d; container = el; }
          }
        }

        // ── 3. Scroll it (instant for consistent state reads) ───────────────
        const delta = dir === "up" || dir === "left" ? -amt : amt;

        if (container) {
          if (toPct !== null) {
            const target = ((container.scrollHeight - container.clientHeight) * toPct) / 100;
            container.scrollTo({ top: target, behavior: "instant" });
          } else if (isVertical) {
            container.scrollBy({ top: delta, behavior: "instant" });
          } else {
            container.scrollBy({ left: delta, behavior: "instant" });
          }
          return scrollInfo(container, containerLabel(container));
        }

        // Strategy D — window fallback
        if (toPct !== null) {
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          window.scrollTo({ top: (maxScroll * toPct) / 100, behavior: "instant" });
        } else if (isVertical) {
          window.scrollBy({ top: delta, behavior: "instant" });
        } else {
          window.scrollBy({ left: delta, behavior: "instant" });
        }
        return scrollInfo(null, "window");
      },
      args: [direction, amount, toSelector ?? null, toPercent ?? null],
    });

    return result.result;
  },

  async HOVER_ELEMENT({
    selector,
    _sourceTabId,
  }: {
    selector: string;
    _sourceTabId?: number;
  }) {
    const tab = await getSourceTab({ _sourceTabId });
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
    _sourceTabId,
  }: {
    selector: string;
    label?: string;
    value?: string;
    _sourceTabId?: number;
  }) {
    const tab = await getSourceTab({ _sourceTabId });
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
    _sourceTabId,
  }: {
    fields: Array<{ selector: string; value: string; type?: string }>;
    submitSelector?: string;
    _sourceTabId?: number;
  }) {
    const tab = await getSourceTab({ _sourceTabId });
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
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          } else if (f.type === "select") {
            (el as HTMLSelectElement).value = f.value;
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          } else {
            el.focus();
            (el as HTMLInputElement).select(); // select all to replace
            const inserted = document.execCommand(
              "insertText",
              false,
              f.value,
            );
            if (!inserted) {
              // Fallback: nativeSetter + synthetic events
              const proto =
                el instanceof HTMLTextAreaElement
                  ? HTMLTextAreaElement.prototype
                  : HTMLInputElement.prototype;
              const setter = Object.getOwnPropertyDescriptor(
                proto,
                "value",
              )?.set;
              if (setter) setter.call(el, f.value);
              else (el as HTMLInputElement).value = f.value;
              el.dispatchEvent(
                new InputEvent("input", {
                  bubbles: true,
                  cancelable: true,
                  inputType: "insertText",
                  data: f.value,
                }),
              );
              el.dispatchEvent(new Event("change", { bubbles: true }));
            } else {
              el.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }
          filledCount++;
        }
        if (submitSel) document.querySelector<HTMLElement>(submitSel)?.click();
        return { success: errors.length === 0, filledCount, errors };
      },
      [fields, submitSelector],
    );
  },

  async GET_PAGE_STRUCTURE({
    filter = "interactive",
    _sourceTabId,
  }: {
    filter?: string;
    _sourceTabId?: number;
  }) {
    const tab = await getSourceTab({ _sourceTabId });
    return injectScript(
      tab.id!,
      (f: string) => {
        const INTERACTIVE = [
          "a[href]", "button", "input", "select", "textarea",
          "[role='button']", "[role='link']", "[role='textbox']",
          "[role='tab']", "[role='menuitem']", "[role='checkbox']",
          "[role='switch']", "[role='combobox']", "[role='option']",
          "[role='slider']", "[role='spinbutton']",
          "[contenteditable='true']", "[contenteditable='']",
          "[onclick]", "[tabindex]:not([tabindex='-1'])",
        ].join(", ");

        const selectors: Record<string, string> = {
          interactive: INTERACTIVE,
          inputs: "input, select, textarea, [role='textbox'], [role='combobox'], [contenteditable='true'], [contenteditable='']",
          links: "a[href], [role='link']",
          buttons: "button, [role='button'], input[type='submit'], input[type='button']",
          all: "body *",
        };
        const query = selectors[f] ?? selectors.interactive;

        function isVisible(el: Element): boolean {
          const h = el as HTMLElement;
          if (h.getAttribute("aria-hidden") === "true") return false;
          const rect = h.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) return false;
          // Check display:none / visibility:hidden only if offsetParent is null
          // (offsetParent is null for display:none, but also for fixed/sticky)
          if (!h.offsetParent && h.style?.position !== "fixed" && h.style?.position !== "sticky") {
            const cs = getComputedStyle(h);
            if (cs.display === "none" || cs.visibility === "hidden") return false;
          }
          return true;
        }

        function getLabel(el: Element): string {
          const h = el as HTMLElement;
          const aria = el.getAttribute("aria-label");
          if (aria) return aria.trim().slice(0, 100);
          const ph = el.getAttribute("placeholder");
          if (ph) return ph.trim().slice(0, 100);
          const tag = el.tagName.toLowerCase();
          if (tag === "input" || tag === "select" || tag === "textarea") {
            return el.getAttribute("name") || el.getAttribute("id") || tag;
          }
          const text = h.innerText?.trim();
          if (text) {
            return text.length > 120 ? text.slice(0, 60) + "..." : text.slice(0, 100);
          }
          return el.getAttribute("title") || el.getAttribute("name") || el.getAttribute("id") || tag;
        }

        function buildSelector(el: Element): string {
          const tag = el.tagName.toLowerCase();
          // data-testid (most stable on SPAs like Twitter, LinkedIn)
          const testId = el.getAttribute("data-testid");
          if (testId) return `[data-testid="${CSS.escape(testId)}"]`;
          // Stable ID (skip auto-generated ones with long numbers)
          if (el.id && !/[0-9]{4,}/.test(el.id) && el.id.length < 80) {
            return "#" + CSS.escape(el.id);
          }
          // aria-label attribute selector
          const aria = el.getAttribute("aria-label");
          if (aria && aria.length < 60) return `${tag}[aria-label="${CSS.escape(aria)}"]`;
          // name attribute (form elements)
          const name = el.getAttribute("name");
          if (name) return `${tag}[name="${CSS.escape(name)}"]`;
          // role + href for links
          const role = el.getAttribute("role");
          if (role) {
            const href = el.getAttribute("href");
            if (href && href.length < 80) return `${tag}[role="${role}"][href="${CSS.escape(href)}"]`;
            return `${tag}[role="${role}"]`;
          }
          // href for regular links
          if (tag === "a") {
            const href = el.getAttribute("href");
            if (href && href.length < 80) return `a[href="${CSS.escape(href)}"]`;
          }
          // type for inputs
          if (tag === "input") return `input[type="${(el as HTMLInputElement).type}"]`;
          return tag;
        }

        const MAX = 80;
        const allMatches = document.querySelectorAll(query);
        const elements = [];
        for (const el of Array.from(allMatches)) {
          if (elements.length >= MAX) break;
          if (!isVisible(el)) continue;
          elements.push({
            tag: el.tagName.toLowerCase(),
            selector: buildSelector(el),
            label: getLabel(el),
            type: (el as HTMLInputElement).type || undefined,
            role: el.getAttribute("role") || undefined,
          });
        }
        return { elements, totalMatched: allMatches.length };
      },
      [filter],
    );
  },

  async GET_ELEMENT_INFO({
    selector,
    _sourceTabId,
  }: {
    selector: string;
    _sourceTabId?: number;
  }) {
    const tab = await getSourceTab({ _sourceTabId });
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
    _sourceTabId,
  }: {
    internalOnly?: boolean;
    limit?: number;
    _sourceTabId?: number;
  }) {
    const tab = await getSourceTab({ _sourceTabId });
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
    _sourceTabId,
  }: {
    selector: string;
    timeout?: number;
    visible?: boolean;
    _sourceTabId?: number;
  }) {
    const tab = await getSourceTab({ _sourceTabId });
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
            if (ok) {
              clearInterval(interval);
              return resolve({ found: true, elapsed: Date.now() - start });
            }
            if (Date.now() - start >= ms) {
              clearInterval(interval);
              return resolve({ found: false, elapsed: ms });
            }
          };
          check(); // immediate first check
          // Use setInterval instead of requestAnimationFrame —
          // rAF doesn't fire in background/inactive tabs
          const interval = setInterval(check, 100);
        });
      },
      [selector, timeout, visible],
    );
  },

  async EXTRACT_DATA({
    description,
    containerSelector,
    limit = 20,
    _sourceTabId,
  }: {
    description: string;
    containerSelector?: string;
    limit?: number;
    _sourceTabId?: number;
  }) {
    const tab = await getSourceTab({ _sourceTabId });
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
    _sourceTabId,
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
    _sourceTabId?: number;
  }) {
    const tab = await getSourceTab({ _sourceTabId });
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
