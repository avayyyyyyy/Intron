# Design System — Chrome Extension Sidepanel Chat UI

> Version 1.0 — March 2026
> Aesthetic target: Minimal, precision-engineered, dark-first. Inspired by Vercel, Linear, Raycast, and Claude.ai.

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Typography](#2-typography)
3. [Color System](#3-color-system)
4. [Spacing & Layout](#4-spacing--layout)
5. [Component Specs](#5-component-specs)
   - [5.1 Header / Nav Bar](#51-header--nav-bar)
   - [5.2 Message List (Scrollback)](#52-message-list-scrollback)
   - [5.3 User Message Bubble](#53-user-message-bubble)
   - [5.4 AI Message Bubble](#54-ai-message-bubble)
   - [5.5 Typing / Streaming Indicator](#55-typing--streaming-indicator)
   - [5.6 Input Area](#56-input-area)
   - [5.7 Send Button](#57-send-button)
   - [5.8 Scrollback Overflow & Fade](#58-scrollback-overflow--fade)
6. [Motion & Animations](#6-motion--animations)
7. [Tailwind Config Tokens](#7-tailwind-config-tokens)
8. [Complete CSS Custom Properties](#8-complete-css-custom-properties)
9. [Font Loading for Chrome Extension](#9-font-loading-for-chrome-extension)
10. [Dark Mode Strategy](#10-dark-mode-strategy)
11. [Glassmorphism Notes](#11-glassmorphism-notes)
12. [Design References & Inspiration](#12-design-references--inspiration)

---

## 1. Design Philosophy

**Core principles** (in order of priority):

1. **Speed** — Every interaction must feel instant. Animations budget is <120ms for micro-interactions, <300ms for entrances.
2. **Minimal chrome** — No shadows that don't earn their place. No decorative borders. No gradients unless they carry meaning.
3. **Density without clutter** — Sidepanel is 400px wide. Every pixel is intentional. Padding must breathe but not waste.
4. **Dark-first** — Default is dark. Not because it's trendy; because code and AI outputs read better at night, and this lives beside a browser.
5. **Typography leads** — Color is secondary. Good type hierarchy makes the color palette almost irrelevant.

**Aesthetic references:**
- **Vercel dashboard** — near-black backgrounds, crisp white text, subtle gray borders, zero decorative noise
- **Linear** — micro-typography precision, LCH-based theming, Inter Display for headings
- **Raycast** — compact density, keyboard-driven, monochrome base with a single accent
- **Claude.ai** — generous line-height on AI responses, clear sender delineation without bubbles
- **Perplexity** — card-style AI answers, source citations as secondary text

---

## 2. Typography

### Font Stack Decision

**Primary (UI text):** Geist Sans — chosen over Inter because:
- Designed specifically for developer-facing products by Vercel × Basement Studio
- Slightly rounder apertures than Inter; friendlier at small sizes
- Ships as a variable font (100–900 wt in one file)
- Self-hostable via `@fontsource-variable/geist` (critical for Chrome extension CSP compliance)

**Monospace (code blocks, addresses, IDs):** Geist Mono — same design language, ensures code feels native.

**Fallback stack:**
```
'Geist Variable', 'Geist', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
```

### Installation (npm — for Chrome extension bundling)

```bash
npm install @fontsource-variable/geist @fontsource-variable/geist-mono
```

### Import in `src/index.css` (top of file)

```css
/* Variable fonts — single file covers weights 100-900 */
@import '@fontsource-variable/geist';
@import '@fontsource-variable/geist-mono';
```

### Why NOT Google Fonts CDN in a Chrome Extension

Chrome extensions run under a strict Content Security Policy. Google Fonts CDN links in `<link>` tags will work for `sidepanel.html` **only if** you add `https://fonts.googleapis.com` and `https://fonts.gstatic.com` to the extension's CSP in `manifest.json`. This is fragile, breaks in offline mode, and adds external network requests. **Self-hosting via npm + Vite bundling is the correct approach** — fonts get inlined or served locally, zero CSP issues.

### Type Scale

All values in `rem` (base 16px). The sidepanel is compact; scale is tight.

| Token             | rem     | px equiv | Usage                                      |
|-------------------|---------|----------|--------------------------------------------|
| `--text-2xs`      | 0.625   | 10px     | Timestamps, version labels                 |
| `--text-xs`       | 0.6875  | 11px     | Secondary metadata, badges                 |
| `--text-sm`       | 0.8125  | 13px     | UI labels, buttons, nav items              |
| `--text-base`     | 0.875   | 14px     | Chat messages (primary reading size)       |
| `--text-md`       | 1.0     | 16px     | Section headings, modal titles             |
| `--text-lg`       | 1.125   | 18px     | Hero/empty state headings                  |
| `--text-xl`       | 1.375   | 22px     | Page-level headings (rare in sidepanel)    |

### Font Weights

| Weight | Token            | Usage                                  |
|--------|------------------|----------------------------------------|
| 400    | `font-normal`    | Body text, AI response content         |
| 450    | (variable only)  | Message text — slightly above regular  |
| 500    | `font-medium`    | Button labels, nav items, sender names |
| 600    | `font-semibold`  | Headings, emphasis                     |

### Line Heights

| Context              | Line Height | Rationale                                      |
|----------------------|-------------|------------------------------------------------|
| UI labels / buttons  | 1.0–1.2     | Dense UI, no wrapping expected                 |
| Chat messages        | 1.6         | Long-form AI responses need breathing room     |
| Code blocks          | 1.5         | Monospace needs consistent baseline            |
| Metadata / captions  | 1.4         | Secondary text, slightly tighter               |

### Letter Spacing

| Context              | Letter Spacing | Value     |
|----------------------|----------------|-----------|
| Large headings       | Tight          | -0.025em  |
| UI labels            | Slightly tight | -0.01em   |
| Body / messages      | Default        | 0         |
| Uppercase labels     | Wide           | +0.06em   |
| Code / mono          | Default        | 0         |

### Tailwind fontFamily config

```js
fontFamily: {
  sans: ['Geist Variable', 'Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  mono: ['Geist Mono Variable', 'Geist Mono', 'ui-monospace', 'monospace'],
},
```

---

## 3. Color System

### Philosophy

Inspired by Vercel's Geist system and shadcn/ui's semantic token approach. Two layers:

1. **Primitive palette** — raw numeric scales (gray-50 through gray-950, plus accent hue)
2. **Semantic tokens** — purpose-named, mapped from primitives, swapped at theme boundary

Dark mode is the **default**. Light mode is toggled via `.light` class on `<html>`.

### Primitive Palette (Hex)

These are the raw values. Semantic tokens reference these.

#### Gray Scale (Zinc-based, neutral with very slight cool undertone)

| Scale | Hex       | Notes                              |
|-------|-----------|------------------------------------|
| 50    | `#fafafa` | Near white                         |
| 100   | `#f4f4f5` | Light bg                           |
| 150   | `#ebebec` | Light hover bg                     |
| 200   | `#e4e4e7` | Light border                       |
| 300   | `#d1d1d6` | Light disabled                     |
| 400   | `#a1a1aa` | Light muted text / placeholders    |
| 500   | `#71717a` | Light secondary text               |
| 600   | `#52525b` | Dark secondary text                |
| 700   | `#3a3a3e` | Dark border                        |
| 750   | `#333338` | Dark hover bg                      |
| 800   | `#222226` | Dark surface / card                |
| 850   | `#1a1a1e` | Dark elevated surface              |
| 900   | `#111113` | Dark app background                |
| 925   | `#0e0e10` | Deepest bg (input area)            |
| 950   | `#0c0c0e` | Near black                         |

#### Accent — Electric Indigo (single hue accent, minimal usage)

| Scale | Hex       | Notes                        |
|-------|-----------|------------------------------|
| 400   | `#818cf8` | Dark mode accent text        |
| 500   | `#2dd4bf` | Primary accent / CTAs        |
| 600   | `#14b8a6` | Hover state                  |
| 700   | `#4338ca` | Active / pressed state       |

#### Semantic colors (destructive, success, warning)

| Name         | Dark hex   | Light hex  |
|--------------|------------|------------|
| Destructive  | `#f87171`  | `#dc2626`  |
| Success      | `#4ade80`  | `#16a34a`  |
| Warning      | `#fb923c`  | `#ea580c`  |

### Semantic Token Map

#### Dark Mode (default — applied to `:root`)

```
--background:        #0c0c0e    /* App shell, outermost bg */
--surface:           #111113    /* Panel / sidepanel body  */
--surface-raised:    #1a1a1e    /* Cards, hover targets    */
--surface-overlay:   #222226    /* Dropdowns, tooltips     */
--border:            #2a2a2e    /* Default border          */
--border-subtle:     #1a1a1e    /* Very subtle dividers    */
--border-strong:     #3a3a3e    /* Focused/active borders  */
--fg:                #fafafa    /* Primary text            */
--fg-muted:          #a1a1aa    /* Secondary/placeholder   */
--fg-subtle:         #71717a    /* Disabled, timestamps    */
--fg-inverted:       #0c0c0e    /* Text on light surfaces  */
--accent:            #2dd4bf    /* Primary CTA color       */
--accent-hover:      #14b8a6    /* Accent hover            */
--accent-muted:      rgba(99,102,241,0.12) /* Accent bg tint */
--accent-fg:         #ffffff    /* Text on accent bg       */
--input-bg:          #0e0e10    /* Chat input background   */
--input-border:      #3a3a3e    /* Input border at rest    */
--input-border-focus:#2dd4bf    /* Input border on focus   */
--msg-user-bg:       #1e1e24    /* User bubble bg          */
--msg-user-fg:       #fafafa    /* User bubble text        */
--msg-ai-bg:         transparent /* AI response bg         */
--msg-ai-fg:         #f4f4f5    /* AI response text        */
--destructive:       #f87171    /* Error states            */
--success:           #4ade80    /* Success states          */
--scrollbar-thumb:   #3a3a3e    /* Scrollbar color         */
--scrollbar-track:   transparent
```

#### Light Mode (applied when `html.light` or via `@media (prefers-color-scheme: light)`)

```
--background:        #ffffff
--surface:           #fafafa
--surface-raised:    #f4f4f5
--surface-overlay:   #ffffff
--border:            #e4e4e7
--border-subtle:     #f4f4f5
--border-strong:     #a1a1aa
--fg:                #0c0c0e
--fg-muted:          #52525b
--fg-subtle:         #71717a
--fg-inverted:       #ffffff
--accent:            #14b8a6
--accent-hover:      #4338ca
--accent-muted:      rgba(79,70,229,0.08)
--accent-fg:         #ffffff
--input-bg:          #f4f4f5
--input-border:      #d1d1d6
--input-border-focus:#14b8a6
--msg-user-bg:       #f4f4f5
--msg-user-fg:       #0c0c0e
--msg-ai-bg:         transparent
--msg-ai-fg:         #111113
--destructive:       #dc2626
--success:           #16a34a
--scrollbar-thumb:   #d1d1d6
--scrollbar-track:   transparent
```

---

## 4. Spacing & Layout

### Base Unit

**4px base grid.** All spacing is multiples of 4px. Use 8px as the fundamental building block for most component internals.

```
4px  = --space-1
8px  = --space-2
12px = --space-3
16px = --space-4
20px = --space-5
24px = --space-6
32px = --space-8
48px = --space-12
```

### Sidepanel Shell Layout

The Chrome sidepanel renders at a variable width (user-resizable), defaulting to ~400px. Design for 360px–480px as the target range. **Do not set a fixed width on the root; let the browser control the panel width.**

```
┌────────────────────────────────────┐
│  HEADER (48px fixed height)        │
├────────────────────────────────────┤
│                                    │
│  MESSAGE LIST (flex-1, scrollable) │
│  overflow-y: auto                  │
│  padding: 12px 16px                │
│                                    │
│                                    │
├────────────────────────────────────┤
│  INPUT AREA (auto height, max      │
│  ~120px + 16px padding = ~152px)   │
└────────────────────────────────────┘
```

**Shell CSS:**
```css
.sidepanel {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  background: var(--surface);
  color: var(--fg);
  font-family: var(--font-sans);
  overflow: hidden;
}
```

### Message List Padding

- Horizontal padding: `16px` on each side
- Vertical padding top: `12px`
- Vertical padding bottom: `8px` (input area provides visual separation)
- Gap between messages: `6px` (same sender, consecutive), `16px` (sender switch)

### Border Radius Scale

| Use                    | Value  | Token        |
|------------------------|--------|--------------|
| Buttons, inputs        | 6px    | `--radius-sm`|
| Message bubbles        | 12px   | `--radius-md`|
| Modals, cards          | 8px    | `--radius-base`|
| Large panels           | 12px   | `--radius-lg`|
| Pill badges            | 9999px | `--radius-full`|

---

## 5. Component Specs

### 5.1 Header / Nav Bar

**Purpose:** Brand identity + minimal controls (settings, model indicator, new chat).

**Layout:**
```
┌──────────────────────────────────────┐
│ [Icon] Agent Name      [···] [+]     │
│ 48px tall, px-4, border-bottom       │
└──────────────────────────────────────┘
```

**Measurements:**
- Height: `48px` fixed
- Padding: `0 16px`
- Border bottom: `1px solid var(--border)`
- Background: `var(--surface)` (matches body, no elevation)

**Typography:**
- Brand name: `13px / font-medium / letter-spacing: -0.01em / color: var(--fg)`
- Model badge: `11px / font-medium / color: var(--fg-muted) / background: var(--surface-raised) / padding: 2px 8px / border-radius: var(--radius-full) / border: 1px solid var(--border)`

**Icon buttons (settings, new chat):**
- Size: `28px × 28px`
- Border-radius: `6px`
- Background at rest: `transparent`
- Background on hover: `var(--surface-raised)`
- Icon color: `var(--fg-muted)` → `var(--fg)` on hover
- Transition: `background 120ms ease, color 120ms ease`

**CSS:**
```css
.header {
  height: 48px;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  flex-shrink: 0;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: -0.01em;
  color: var(--fg);
}

.header-brand svg {
  width: 16px;
  height: 16px;
  color: var(--fg-muted);
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.icon-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}

.icon-btn:hover {
  background: var(--surface-raised);
  color: var(--fg);
}

.icon-btn svg {
  width: 15px;
  height: 15px;
}
```

---

### 5.2 Message List (Scrollback)

**Purpose:** The main content area. Must scroll, must fade at top edge, must not clip content.

**Scrollbar styling** (webkit only — Chrome extension, so safe to use):
```css
.message-list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 16px 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  scroll-behavior: smooth;
  /* Custom scrollbar */
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
}

.message-list::-webkit-scrollbar {
  width: 4px;
}

.message-list::-webkit-scrollbar-track {
  background: transparent;
}

.message-list::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 9999px;
}

.message-list::-webkit-scrollbar-thumb:hover {
  background: var(--border-strong);
}
```

**Message group spacing:**

When messages are from the same sender consecutively, reduce top gap:
```css
/* Same-sender consecutive message: tighter gap */
.msg-group + .msg-group {
  margin-top: 6px;
}
/* Sender change: larger gap */
.msg-group[data-sender="user"] + .msg-group[data-sender="ai"],
.msg-group[data-sender="ai"] + .msg-group[data-sender="user"] {
  margin-top: 16px;
}
```

**Empty state:**
```
┌─────────────────────────────┐
│                             │
│    [Agent Icon — 32px]      │
│    Ask me anything          │  (16px, font-medium, fg)
│    I can help with Twitter  │  (13px, fg-muted)
│                             │
└─────────────────────────────┘
```
CSS: centered flex column, gap 8px, positioned absolutely center of scroll area.

---

### 5.3 User Message Bubble

**Design decision:** Right-aligned bubble with background fill. The user's input is shorter, definitive — a filled bubble signals "sent."

**Visual:**
```
                  ┌──────────────────┐
                  │ Your message here│ ← var(--msg-user-bg)
                  └──────────────────┘
                          14px, line-height 1.6
```

**Measurements:**
- Max-width: `80%` of container (≈ 288px at 360px panel)
- Min-width: none
- Padding: `8px 12px`
- Border-radius: `12px 12px 4px 12px` (the bottom-right corner "pinches" toward the sender)
- Background: `var(--msg-user-bg)` → `#222226` dark / `#f4f4f5` light
- Border: `1px solid var(--border)` (subtle, prevents bg from floating)
- Font: `14px / 1.6 / font-normal / color: var(--msg-user-fg)`
- Alignment: `align-self: flex-end` (right side)

**Timestamp:**
- `10px / fg-subtle / font-variant-numeric: tabular-nums`
- Appears below the bubble, right-aligned
- Only visible on hover (opacity transition)

```css
.msg-user-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.msg-user-bubble {
  max-width: 80%;
  padding: 8px 12px;
  border-radius: 12px 12px 4px 12px;
  background: var(--msg-user-bg);
  border: 1px solid var(--border);
  font-size: 14px;
  line-height: 1.6;
  color: var(--msg-user-fg);
  word-break: break-word;
}

.msg-timestamp {
  font-size: 10px;
  color: var(--fg-subtle);
  font-variant-numeric: tabular-nums;
  opacity: 0;
  transition: opacity 150ms ease;
}

.msg-user-wrap:hover .msg-timestamp {
  opacity: 1;
}
```

---

### 5.4 AI Message Bubble

**Design decision:** NO bubble background. AI responses use full-width text with only left alignment and an optional subtle left border accent. This matches the Claude.ai and Perplexity aesthetic — AI output feels like a document, not a chat ping.

**Visual:**
```
┌─── (no border, transparent bg)
│ AI response text appears here in
│ full width. Multiple paragraphs.
│ Code is rendered in a mono block.
└───
```

**Measurements:**
- Width: full (no max-width constraint — AI responses should use the full panel width)
- Padding: `0` (no bubble padding — content sits flush in the message list padding)
- Background: `transparent`
- Font: `14px / 1.6 / font-normal / color: var(--msg-ai-fg)`
- Alignment: `align-self: flex-start`

**Sender label (minimal):**
- Not an avatar. Just a small label/chip.
- `11px / font-medium / color: var(--fg-subtle)`
- Content: "Agent" or custom name
- Appears above the first message in each AI group, disappears for consecutive messages

**Code blocks inside AI messages:**
```css
.msg-ai-content pre {
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.5;
  overflow-x: auto;
  margin: 8px 0;
}

.msg-ai-content code {
  font-family: var(--font-mono);
  font-size: 12px;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 1px 4px;
}
```

**Inline links in AI messages:**
```css
.msg-ai-content a {
  color: var(--accent);
  text-decoration: underline;
  text-decoration-color: var(--accent-muted);
  text-underline-offset: 2px;
  transition: text-decoration-color 120ms ease;
}

.msg-ai-content a:hover {
  text-decoration-color: var(--accent);
}
```

**Full CSS:**
```css
.msg-ai-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
}

.msg-ai-sender {
  font-size: 11px;
  font-weight: 500;
  color: var(--fg-subtle);
  letter-spacing: 0.01em;
}

.msg-ai-content {
  font-size: 14px;
  line-height: 1.6;
  color: var(--msg-ai-fg);
  width: 100%;
}

.msg-ai-content p + p {
  margin-top: 8px;
}

.msg-ai-content ul,
.msg-ai-content ol {
  padding-left: 20px;
  margin: 6px 0;
}

.msg-ai-content li {
  margin: 3px 0;
}
```

---

### 5.5 Typing / Streaming Indicator

**Two states to handle:**

#### State A: Waiting (before first token arrives)
Show a three-dot pulse animation inside a minimal container.

```
[·  ·  ·]  ← animated dots, left-aligned where AI message will appear
```

```css
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 0;
}

.typing-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--fg-subtle);
  animation: typing-pulse 1.4s ease-in-out infinite;
}

.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing-pulse {
  0%, 60%, 100% {
    opacity: 0.3;
    transform: translateY(0);
  }
  30% {
    opacity: 1;
    transform: translateY(-3px);
  }
}
```

#### State B: Streaming (tokens arriving)
Text renders progressively. Add a blinking cursor at the end of the current token stream.

```css
/* Streaming cursor */
.streaming-cursor {
  display: inline-block;
  width: 2px;
  height: 14px;
  background: var(--fg-muted);
  border-radius: 1px;
  margin-left: 1px;
  vertical-align: text-bottom;
  animation: cursor-blink 1s ease-in-out infinite;
}

@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
```

**Shimmer effect for loading states** (e.g., model initialization):
```css
.shimmer-line {
  height: 12px;
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    var(--surface-raised) 0%,
    var(--surface-overlay) 50%,
    var(--surface-raised) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

### 5.6 Input Area

**Design decision:** Fixed to bottom, slightly elevated (subtle top border). Single textarea that grows with content up to ~4 lines. NOT a full send button row — icons are inside the input container.

**Visual:**
```
┌─────────────────────────────────────┐
│ border-top: 1px var(--border)       │
│ padding: 12px 16px                  │
│ ┌─────────────────────────────────┐ │
│ │ textarea (auto-grow, max 4 rows)│ │
│ │                           [↑]  │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Container measurements:**
- Border top: `1px solid var(--border)`
- Padding: `12px 16px`
- Background: `var(--surface)`

**Textarea wrapper (the box):**
- Background: `var(--input-bg)` → `#0e0e10`
- Border: `1px solid var(--input-border)`
- Border-radius: `8px`
- Padding: `10px 12px`
- Transition on focus: border → `var(--input-border-focus)` in 150ms
- Box-shadow on focus: `0 0 0 3px var(--accent-muted)` (the "glow ring")

**Textarea itself:**
- Width: `100%`
- Min-height: `20px` (single line)
- Max-height: `96px` (~4 lines at 1.5 line-height × 14px × 4 + padding)
- Resize: `none`
- Background: `transparent`
- Border: `none`
- Outline: `none`
- Font: inherit (14px, Geist Variable)
- Color: `var(--fg)`
- Placeholder color: `var(--fg-muted)`
- Line-height: `1.5`

**CSS:**
```css
.input-area {
  flex-shrink: 0;
  border-top: 1px solid var(--border);
  padding: 12px 16px;
  background: var(--surface);
}

.input-box {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: 8px;
  padding: 10px 12px;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

.input-box:focus-within {
  border-color: var(--input-border-focus);
  box-shadow: 0 0 0 3px var(--accent-muted);
}

.input-textarea {
  flex: 1;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  color: var(--fg);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  min-height: 20px;
  max-height: 96px;
  overflow-y: auto;
}

.input-textarea::placeholder {
  color: var(--fg-muted);
}

/* Auto-resize pattern (needs JS: textarea.style.height = textarea.scrollHeight + 'px') */
```

---

### 5.7 Send Button

**Behavior:** Disabled (dimmed) when textarea is empty. Active (accent fill) when there's content. Shows a spinner when a request is in-flight.

**Measurements:**
- Size: `28px × 28px`
- Border-radius: `6px`
- Icon: `14px × 14px` arrow-up SVG

**States:**

| State    | Background            | Color               | Cursor   |
|----------|-----------------------|---------------------|----------|
| Empty    | `transparent`         | `var(--fg-subtle)`  | default  |
| Ready    | `var(--accent)`       | `white`             | pointer  |
| Hover    | `var(--accent-hover)` | `white`             | pointer  |
| Sending  | `var(--surface-raised)` | `var(--fg-muted)` | not-allowed |

```css
.send-btn {
  width: 28px;
  height: 28px;
  min-width: 28px;
  border-radius: 6px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease, transform 100ms ease;
}

.send-btn:disabled {
  background: transparent;
  color: var(--fg-subtle);
  cursor: default;
}

.send-btn:not(:disabled) {
  background: var(--accent);
  color: white;
}

.send-btn:not(:disabled):hover {
  background: var(--accent-hover);
}

.send-btn:not(:disabled):active {
  transform: scale(0.92);
}

.send-btn svg {
  width: 14px;
  height: 14px;
}

/* Loading spinner (replaces icon when sending) */
.send-btn.loading svg {
  animation: spin 700ms linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

---

### 5.8 Scrollback Overflow & Fade

Apply a top-edge fade on the message list to visually indicate scrollable content above.

```css
.message-list-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
}

/* Top fade */
.message-list-wrapper::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 32px;
  background: linear-gradient(to bottom, var(--surface), transparent);
  z-index: 1;
  pointer-events: none;
}

.message-list {
  height: 100%;
  overflow-y: auto;
  /* ... (from §5.2) */
}
```

**"Scroll to bottom" button** (appears when user has scrolled up):
- Fixed at bottom-right of message list, above input area
- `32px × 32px` circle
- Background: `var(--surface-overlay)` with `border: 1px solid var(--border)`
- Appears with fade + slide-up animation
- Disappears when user is at bottom

---

## 6. Motion & Animations

### Principles

1. **Duration budget:** Micro (80–120ms), entrance (200–280ms), complex (300–400ms). Nothing above 400ms unless it's a meaningful state transition.
2. **Easing:** Use CSS cubic-bezier curves. Avoid linear for anything user-facing.
3. **Spring physics:** Prefer framer-motion spring for layout changes and drag. CSS transitions for color/opacity.
4. **Reduced motion:** Always wrap non-trivial animations in `@media (prefers-reduced-motion: no-preference)`.

### Easing Curves (named)

```css
:root {
  /* Standard eases */
  --ease-out-smooth: cubic-bezier(0.0, 0.0, 0.2, 1.0);    /* Material decel */
  --ease-in-smooth:  cubic-bezier(0.4, 0.0, 1.0, 1.0);    /* Material accel */
  --ease-bounce:     cubic-bezier(0.34, 1.56, 0.64, 1.0);  /* Slight overshoot */
  --ease-snappy:     cubic-bezier(0.25, 0.46, 0.45, 0.94); /* Fast, clean */
  --ease-spring:     cubic-bezier(0.175, 0.885, 0.32, 1.275); /* Springy */
}
```

### Core Keyframes

```css
/* Message entrance — slides up from 6px below, fades in */
@keyframes msg-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Fade in only (for AI content chunks as they stream) */
@keyframes fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* Slide up (general entrance) */
@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Slide down (for "scroll to bottom" button) */
@keyframes slide-down-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Scale pop (for send button confirmation) */
@keyframes scale-pop {
  0%   { transform: scale(1); }
  50%  { transform: scale(0.88); }
  100% { transform: scale(1); }
}

/* Typing dot bounce */
@keyframes typing-pulse {
  0%, 60%, 100% {
    opacity: 0.3;
    transform: translateY(0);
  }
  30% {
    opacity: 1;
    transform: translateY(-3px);
  }
}

/* Shimmer sweep */
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Cursor blink */
@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}

/* Spin (loading) */
@keyframes spin {
  to { transform: rotate(360deg); }
}
```

### Animation Application

| Element                 | Animation          | Duration | Easing             | Delay (stagger) |
|-------------------------|--------------------|----------|--------------------|-----------------|
| User message appears    | `msg-in`           | 200ms    | `--ease-out-smooth`| 0ms             |
| AI message first chunk  | `msg-in`           | 220ms    | `--ease-out-smooth`| 0ms             |
| AI streaming chunks     | `fade-in`          | 100ms    | linear             | 0ms (each chunk)|
| Typing indicator        | `typing-pulse`     | 1400ms   | ease-in-out        | staggered 200ms |
| Header on load          | `fade-in`          | 300ms    | `--ease-out-smooth`| 0ms             |
| Input area on load      | `slide-up`         | 300ms    | `--ease-out-smooth`| 50ms            |
| Scroll-to-bottom btn    | `slide-up`         | 200ms    | `--ease-bounce`    | 0ms             |
| Send button press       | `scale-pop`        | 100ms    | `--ease-snappy`    | 0ms             |
| Send btn ready state    | color transition   | 150ms    | ease               | 0ms             |

### Framer Motion Values (for React implementation)

If using `framer-motion`, replace CSS keyframes with these values for physics-based animations:

```ts
// Message entrance (user bubble)
const msgUserVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 28,
      mass: 0.8,
    },
  },
};

// Message entrance (AI message)
const msgAiVariants = {
  hidden: { opacity: 0, y: 4 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 350,
      damping: 26,
      mass: 0.9,
    },
  },
};

// Typing indicator dot
const dotVariants = {
  rest: { y: 0, opacity: 0.3 },
  pulse: {
    y: -3,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 15,
    },
  },
};

// Send button press feedback
const sendBtnTap = { scale: 0.88 };
const sendBtnTransition = {
  type: 'spring',
  stiffness: 600,
  damping: 20,
};

// Scroll-to-bottom button
const scrollBtnVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 25,
    },
  },
};
```

### Reduced Motion Override

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 7. Tailwind Config Tokens

Replace the existing `tailwind.config.js` with this full configuration:

```js
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./sidepanel.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class', // toggle via html.dark / html.light class
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist Variable', 'Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono Variable', 'Geist Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1.2' }],   // 10px
        xs:    ['0.6875rem', { lineHeight: '1.4' }],   // 11px
        sm:    ['0.8125rem', { lineHeight: '1.4' }],   // 13px
        base:  ['0.875rem', { lineHeight: '1.6' }],    // 14px — chat messages
        md:    ['1rem', { lineHeight: '1.5' }],         // 16px
        lg:    ['1.125rem', { lineHeight: '1.4' }],    // 18px
        xl:    ['1.375rem', { lineHeight: '1.3' }],    // 22px
      },
      colors: {
        // Primitive scale — used internally to build semantic tokens
        zinc: {
          50:  '#fafafa',
          100: '#f4f4f5',
          150: '#ebebec',
          200: '#e4e4e7',
          300: '#d1d1d6',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3a3a3e',
          750: '#333338',
          800: '#222226',
          850: '#1a1a1e',
          900: '#111113',
          925: '#0e0e10',
          950: '#0c0c0e',
        },
        // Accent
        teal: {
          400: '#818cf8',
          500: '#2dd4bf',
          600: '#14b8a6',
          700: '#4338ca',
        },
        // Semantic tokens via CSS vars (used in components)
        background:    'var(--background)',
        surface:       'var(--surface)',
        'surface-raised': 'var(--surface-raised)',
        'surface-overlay': 'var(--surface-overlay)',
        border:        'var(--border)',
        fg:            'var(--fg)',
        'fg-muted':    'var(--fg-muted)',
        'fg-subtle':   'var(--fg-subtle)',
        accent:        'var(--accent)',
        'accent-hover':'var(--accent-hover)',
        destructive:   'var(--destructive)',
        success:       'var(--success)',
      },
      borderRadius: {
        sm:   '6px',
        base: '8px',
        md:   '12px',
        lg:   '16px',
        full: '9999px',
      },
      spacing: {
        '1':  '4px',
        '2':  '8px',
        '3':  '12px',
        '4':  '16px',
        '5':  '20px',
        '6':  '24px',
        '8':  '32px',
        '10': '40px',
        '12': '48px',
      },
      transitionTimingFunction: {
        'out-smooth': 'cubic-bezier(0.0, 0.0, 0.2, 1.0)',
        'in-smooth':  'cubic-bezier(0.4, 0.0, 1.0, 1.0)',
        'bounce-sm':  'cubic-bezier(0.34, 1.56, 0.64, 1.0)',
        'snappy':     'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'spring':     'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      },
      keyframes: {
        'msg-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'typing-pulse': {
          '0%, 60%, 100%': { opacity: '0.3', transform: 'translateY(0)' },
          '30%':           { opacity: '1',   transform: 'translateY(-3px)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'cursor-blink': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'msg-in':        'msg-in 200ms cubic-bezier(0.0, 0.0, 0.2, 1.0) both',
        'fade-in':       'fade-in 100ms ease both',
        'slide-up':      'slide-up 300ms cubic-bezier(0.0, 0.0, 0.2, 1.0) both',
        'typing-pulse':  'typing-pulse 1400ms ease-in-out infinite',
        shimmer:         'shimmer 1500ms ease-in-out infinite',
        'cursor-blink':  'cursor-blink 1000ms ease-in-out infinite',
        spin:            'spin 700ms linear infinite',
      },
    },
  },
  plugins: [],
};
```

---

## 8. Complete CSS Custom Properties

This is the complete `index.css` base layer defining all tokens. Add this to the top of `src/index.css` after font imports:

```css
/* ── Font imports ──────────────────────────────────────── */
@import '@fontsource-variable/geist';
@import '@fontsource-variable/geist-mono';

@tailwind base;
@tailwind components;
@tailwind utilities;

/* ── CSS Custom Properties ─────────────────────────────── */
:root {
  /* Font stacks */
  --font-sans: 'Geist Variable', 'Geist', ui-sans-serif, system-ui, -apple-system, sans-serif;
  --font-mono: 'Geist Mono Variable', 'Geist Mono', ui-monospace, SFMono-Regular, monospace;

  /* Type scale */
  --text-2xs: 0.625rem;
  --text-xs:  0.6875rem;
  --text-sm:  0.8125rem;
  --text-base: 0.875rem;
  --text-md:  1rem;
  --text-lg:  1.125rem;
  --text-xl:  1.375rem;

  /* Border radius */
  --radius-sm:   6px;
  --radius-base: 8px;
  --radius-md:   12px;
  --radius-lg:   16px;
  --radius-full: 9999px;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  /* Easing */
  --ease-out-smooth: cubic-bezier(0.0, 0.0, 0.2, 1.0);
  --ease-in-smooth:  cubic-bezier(0.4, 0.0, 1.0, 1.0);
  --ease-bounce:     cubic-bezier(0.34, 1.56, 0.64, 1.0);
  --ease-snappy:     cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --ease-spring:     cubic-bezier(0.175, 0.885, 0.32, 1.275);

  /* ── DARK MODE COLORS (default) ──────────────────────── */
  --background:         #0c0c0e;
  --surface:            #111113;
  --surface-raised:     #1a1a1e;
  --surface-overlay:    #222226;
  --border:             #2a2a2e;
  --border-subtle:      #1a1a1e;
  --border-strong:      #3a3a3e;
  --fg:                 #fafafa;
  --fg-muted:           #a1a1aa;
  --fg-subtle:          #71717a;
  --fg-inverted:        #0c0c0e;
  --accent:             #2dd4bf;
  --accent-hover:       #14b8a6;
  --accent-muted:       rgba(99, 102, 241, 0.12);
  --accent-fg:          #ffffff;
  --input-bg:           #0e0e10;
  --input-border:       #3a3a3e;
  --input-border-focus: #2dd4bf;
  --msg-user-bg:        #1e1e24;
  --msg-user-fg:        #fafafa;
  --msg-ai-bg:          transparent;
  --msg-ai-fg:          #f4f4f5;
  --destructive:        #f87171;
  --success:            #4ade80;
  --warning:            #fb923c;
  --scrollbar-thumb:    #3a3a3e;
  --scrollbar-track:    transparent;
}

/* ── LIGHT MODE OVERRIDE ──────────────────────────────── */
html.light {
  --background:         #ffffff;
  --surface:            #fafafa;
  --surface-raised:     #f4f4f5;
  --surface-overlay:    #ffffff;
  --border:             #e4e4e7;
  --border-subtle:      #f4f4f5;
  --border-strong:      #a1a1aa;
  --fg:                 #0c0c0e;
  --fg-muted:           #52525b;
  --fg-subtle:          #71717a;
  --fg-inverted:        #ffffff;
  --accent:             #14b8a6;
  --accent-hover:       #4338ca;
  --accent-muted:       rgba(79, 70, 229, 0.08);
  --accent-fg:          #ffffff;
  --input-bg:           #f4f4f5;
  --input-border:       #d1d1d6;
  --input-border-focus: #14b8a6;
  --msg-user-bg:        #f4f4f5;
  --msg-user-fg:        #0c0c0e;
  --msg-ai-bg:          transparent;
  --msg-ai-fg:          #111113;
  --destructive:        #dc2626;
  --success:            #16a34a;
  --warning:            #ea580c;
  --scrollbar-thumb:    #d1d1d6;
  --scrollbar-track:    transparent;
}

/* ── SYSTEM PREFERENCE FALLBACK ──────────────────────── */
@media (prefers-color-scheme: light) {
  :root:not(.dark) {
    --background:         #ffffff;
    --surface:            #fafafa;
    /* ... repeat light values */
  }
}

/* ── BASE STYLES ─────────────────────────────────────── */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  color-scheme: dark;
  font-size: 16px;
}

html.light {
  color-scheme: light;
}

body {
  font-family: var(--font-sans);
  background: var(--background);
  color: var(--fg);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-feature-settings: 'cv01', 'cv02', 'cv03', 'cv04';
  /* Geist has nice number alternates — enable them */
  font-variant-numeric: tabular-nums;
  overflow: hidden; /* Sidepanel manages its own scroll */
}

/* ── REDUCED MOTION ──────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 9. Font Loading for Chrome Extension

### The Problem

Chrome extensions have a strict Content Security Policy. External requests to `fonts.googleapis.com` are blocked by default unless you explicitly add them to your manifest CSP. Even then, this causes network dependency and fails offline.

### The Solution: npm + Vite bundling

Fontsource packages embed `@font-face` declarations and WOFF2 files. When you `@import` them in CSS and build with Vite, the font files get copied to `dist/` and referenced with relative paths — entirely local, zero CSP issues.

#### Step 1: Install packages

```bash
npm install @fontsource-variable/geist @fontsource-variable/geist-mono
```

#### Step 2: Import in `src/index.css` (first two lines)

```css
@import '@fontsource-variable/geist';
@import '@fontsource-variable/geist-mono';
```

#### Step 3: Remove Google Fonts from `sidepanel.html`

Delete these lines from `sidepanel.html`:
```html
<!-- REMOVE THESE -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
```

#### Step 4: Vite handles the rest

Vite will detect the `url()` references in the fontsource CSS and include the WOFF2 files in the build output. Fonts load from `dist/assets/` alongside your JS bundle.

#### Manifest CSP (no changes needed)

With self-hosted fonts, your `manifest.json` CSP does NOT need to reference any external font URLs. Keep it clean:

```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'"
}
```

#### Verify after build

```bash
npm run build
ls dist/assets/*.woff2  # Should show Geist font files
```

---

## 10. Dark Mode Strategy

### Architecture

- **Default state:** Dark mode. `:root` carries dark tokens.
- **Toggle mechanism:** Add `light` class to `<html>` element via a settings toggle.
- **Persistence:** Store preference in `chrome.storage.local` with key `"theme"`.
- **System preference:** Check `window.matchMedia('(prefers-color-scheme: dark)')` on first launch if no stored preference exists.

### Implementation (React)

```tsx
// src/hooks/useTheme.ts
import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    // Read from chrome.storage or localStorage for non-extension environments
    const stored = localStorage.getItem('theme') as Theme | null;
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial: Theme = stored ?? (systemDark ? 'dark' : 'light');
    applyTheme(initial);
    setTheme(initial);
  }, []);

  function applyTheme(t: Theme) {
    document.documentElement.classList.toggle('light', t === 'light');
    document.documentElement.classList.toggle('dark', t === 'dark');
  }

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
    localStorage.setItem('theme', next);
  }

  return { theme, toggle };
}
```

---

## 11. Glassmorphism Notes

### When to use it

Glassmorphism (`backdrop-filter: blur()`) is appropriate for **overlay elements** that float above the content: tooltips, dropdown menus, the "scroll to bottom" button. It is **not** appropriate for the main sidepanel body (the glass needs something interesting behind it to blur; a solid dark background produces no effect).

### CSS Pattern (dark glassmorphism)

```css
.glass-overlay {
  background: rgba(18, 18, 20, 0.80);   /* Near-opaque dark tint */
  backdrop-filter: blur(12px) saturate(1.5);
  -webkit-backdrop-filter: blur(12px) saturate(1.5);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: var(--radius-md);
}
```

### CSS Pattern (light glassmorphism)

```css
.glass-overlay.light {
  background: rgba(250, 250, 250, 0.85);
  backdrop-filter: blur(12px) saturate(1.8);
  -webkit-backdrop-filter: blur(12px) saturate(1.8);
  border: 1px solid rgba(0, 0, 0, 0.08);
}
```

### Performance Caution

`backdrop-filter` triggers GPU compositing. Use `will-change: transform` on the element to promote it to its own layer. **Do not animate** `backdrop-filter` blur values — this is very expensive. Animate `opacity` instead to show/hide glass elements.

```css
.glass-overlay {
  /* ... */
  will-change: transform;
  transition: opacity 150ms var(--ease-out-smooth);
}
```

### Chrome Extension Compatibility

`backdrop-filter` is fully supported in Chrome (Chromium-based sidepanel). No prefixing issues. The `-webkit-backdrop-filter` prefix is required for Safari but harmless in Chrome.

---

## 12. Design References & Inspiration

### Primary References

| Product                | What to steal                                               | URL                                           |
|------------------------|-------------------------------------------------------------|-----------------------------------------------|
| **Vercel Dashboard**   | Near-black bg, zero-decoration borders, crisp type         | https://vercel.com                            |
| **Vercel Geist System**| Complete color scale, semantic token architecture           | https://vercel.com/geist/colors               |
| **Linear App**         | Inter Display headings, LCH color space, micro-typography  | https://linear.app                            |
| **Raycast**            | Compact density, monochrome + single accent, icon buttons  | https://raycast.com                           |
| **Claude.ai**          | No-bubble AI responses, generous line-height, clean input  | https://claude.ai                             |
| **Perplexity**         | Card-style answers, source citation layout                  | https://perplexity.ai                         |
| **shadcn/ui**          | Token architecture, OKLCH semantic variables               | https://ui.shadcn.com/docs/theming            |

### Typography Deep-Dive

| Resource                                                      | URL                                                          |
|---------------------------------------------------------------|--------------------------------------------------------------|
| Geist Font (Vercel official)                                  | https://vercel.com/font                                      |
| Fontsource Geist install guide                                | https://fontsource.org/fonts/geist/install                   |
| Inter font — design rationale                                 | https://rsms.me/inter/                                       |
| Geist on Pimp My Type (comparison review)                     | https://pimpmytype.com/font/geist/                           |
| Untitled UI — best free fonts for modern design               | https://www.untitledui.com/blog/best-free-fonts              |

### Animation & Motion

| Resource                                     | URL                                                  |
|----------------------------------------------|------------------------------------------------------|
| Motion (Framer Motion) official docs          | https://motion.dev                                   |
| Chat animation with Framer Motion (sandbox)   | https://codesandbox.io/s/chat-message-animations-framer-motion-e4gs3l |
| Smooth text streaming (Upstash)               | https://upstash.com/blog/smooth-streaming            |

### Color Theory & Tooling

| Resource                                | URL                                                            |
|-----------------------------------------|----------------------------------------------------------------|
| Dark Mode UI Best Practices 2025        | https://dopelycolors.com/blog/dark-mode-ui-perfect-theme-palette |
| Glassmorphism CSS Generator             | https://ui.glass/generator                                     |
| shadcn/ui color explorer                | https://ui.shadcn.com/colors                                   |
| tweakcn theme editor                    | https://tweakcn.com                                            |

### Design Principles Articles

| Article                                  | URL                                                            |
|------------------------------------------|----------------------------------------------------------------|
| How Linear redesigned their UI (Part II) | https://linear.app/now/how-we-redesigned-the-linear-ui        |
| The rise of Linear-style design          | https://medium.com/design-bootcamp/the-rise-of-linear-style-design-origins-trends-and-techniques-4fd96aab7646 |
| AI UI Patterns (patterns.dev)            | https://www.patterns.dev/react/ai-ui-patterns/                |

---

## Quick Implementation Checklist

For a developer starting from the current `src/` codebase:

- [ ] `npm install @fontsource-variable/geist @fontsource-variable/geist-mono`
- [ ] Replace `src/index.css` top with `@import` for both font packages (remove Google Fonts)
- [ ] Remove Google Fonts `<link>` tags from `sidepanel.html`
- [ ] Add all CSS custom properties from §8 to `src/index.css`
- [ ] Replace `tailwind.config.js` with config from §7
- [ ] Update `App.tsx` to three-section layout: `<Header>`, `<MessageList>`, `<InputArea>`
- [ ] Implement `useTheme` hook from §10
- [ ] Apply `animate-msg-in` class to each message on mount
- [ ] Implement typing indicator with `typing-dot` + `animate-typing-pulse` classes
- [ ] Implement auto-grow textarea (JS: `el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'`)
- [ ] Implement send button state (disabled when empty, loading spinner when in-flight)
- [ ] Add scrollbar styles to `.message-list` (§5.2)
- [ ] Add top-edge fade gradient (§5.8)
- [ ] Test at 360px, 400px, and 480px panel widths
- [ ] Test with `prefers-reduced-motion: reduce` via Chrome DevTools

---

*Design system authored March 2026. Aesthetic target: minimal, precision-engineered, dark-first.*
