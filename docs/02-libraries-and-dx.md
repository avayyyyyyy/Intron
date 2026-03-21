# Libraries & DX Stack

> Reference doc for the Twitter/computer-use agent Chrome Extension (MV3).
> Stack: React 18 + TypeScript + Bun + Vite + side-panel UI.

---

## Current baseline (already installed)

| Package | Version | Role |
|---|---|---|
| react / react-dom | ^18.3.1 | UI runtime |
| @vitejs/plugin-react | ^4.3.4 | Vite React transform |
| tailwindcss | ^3.4.17 | Utility CSS (v3) |
| autoprefixer / postcss | latest | CSS pipeline |
| typescript | ^5.7.2 | Type checking |
| vite | ^6.0.5 | Build tool |

The project already has `@` path alias configured in both `vite.config.ts` and `tsconfig.json`, and `strict: true` TypeScript. The sections below describe what to add and why.

---

## 1. UI Component Library — shadcn/ui

### Why

shadcn/ui is not a traditional npm package — it copies component source code directly into `src/components/ui/`. This means:
- Zero runtime dependency on an external design system
- Full control to customise every component
- Built on Radix UI primitives (fully accessible, headless)
- Works identically in Vite (no Next.js required)
- The CLI handles path aliases, `components.json`, and Tailwind integration automatically

### Install

shadcn/ui requires Tailwind v4 for its current CLI. Upgrade Tailwind first (see Section 2), then:

```bash
# Run the shadcn init CLI (uses bunx, no install needed)
bunx shadcn@latest init
```

The CLI will prompt for:
- Style: `new-york` (recommended — more polished defaults)
- Base color: your choice (e.g. `neutral`)
- CSS variable location: `src/index.css`

It creates `components.json` and writes CSS variables into your global stylesheet.

After init, add components as needed:

```bash
bunx shadcn@latest add button
bunx shadcn@latest add input textarea scroll-area badge separator
bunx shadcn@latest add dropdown-menu tooltip
```

Components land in `src/components/ui/` and can be edited freely.

### Chrome Extension caveats

**No SSR, no hydration issues.** The side panel is a plain HTML page (`sidepanel.html`) rendered entirely client-side — shadcn/ui works without any changes.

**Fonts.** The current `sidepanel.html` loads Google Fonts over the network. Chrome extensions can load remote resources from the side panel without CSP issues (unlike content scripts). Keep the existing font setup or self-host fonts in `src/assets/`.

**No `document.cookie` / `localStorage` conflicts.** shadcn components do not touch storage. The Radix UI portals (`Dialog`, `Tooltip`, etc.) render into `document.body` of the side-panel page, which is isolated from the host tab.

### Dependencies pulled in automatically

```bash
bun add clsx tailwind-merge class-variance-authority
bun add @radix-ui/react-slot
```

The `cn()` helper (created by the CLI at `src/lib/utils.ts`) combines `clsx` + `tailwind-merge`:

```ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

## 2. Styling — Tailwind CSS v4

### Why upgrade from v3

The project currently has Tailwind v3 (`^3.4.17`). The shadcn CLI now targets Tailwind v4. v4 brings:
- CSS-native cascade layers, no `tailwind.config.js` required
- `@import "tailwindcss"` replaces the three `@tailwind` directives
- New `@tailwindcss/vite` plugin (faster, no PostCSS pipeline needed for Vite)
- OKLCH color space by default, `tw-animate-css` replaces `tailwindcss-animate`

### Install

```bash
# Remove v3 packages
bun remove tailwindcss autoprefixer postcss

# Install v4 + Vite plugin
bun add -d tailwindcss @tailwindcss/vite
```

### vite.config.ts changes

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";   // add this
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),   // replaces postcss pipeline
  ],
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: path.resolve(__dirname, "sidepanel.html"),
      },
      output: {
        // Chrome extensions need deterministic filenames (no hash for entry points)
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

### CSS entry point (src/index.css)

Replace the existing Tailwind directives:

```css
/* v4 — single import replaces @tailwind base/components/utilities */
@import "tailwindcss";

/* Custom theme tokens (shadcn/ui will add its variables here via CLI) */
@layer base {
  :root {
    --background: oklch(1 0 0);
    --foreground: oklch(0.145 0 0);
    /* ... shadcn palette vars ... */
  }
  .dark {
    --background: oklch(0.145 0 0);
    --foreground: oklch(0.985 0 0);
  }
}

/* Existing custom fonts still work */
@layer base {
  body {
    font-family: "Syne", system-ui, sans-serif;
  }
  code, pre {
    font-family: "Space Mono", monospace;
  }
}
```

Delete `postcss.config.js` and `tailwind.config.js` after migration — they are not needed with the Vite plugin.

### Chrome Extension caveat: relative paths

Vite defaults to absolute asset paths (`/assets/...`). Chrome extensions require relative paths. The `base: "./"` already set in `vite.config.ts` handles this correctly. Verify the built `sidepanel.html` references `./assets/...` not `/assets/...`.

---

## 3. Icons — lucide-react

### Why

- Official icon library for shadcn/ui (every component uses it)
- 1,600+ icons, MIT license
- Fully tree-shakable — only imported icons appear in the bundle
- TypeScript-first, consistent `size`, `color`, `strokeWidth` props
- ~15 KB total for 50 icons (best-in-class bundle efficiency among icon libs)

### Install

```bash
bun add lucide-react
```

### Usage

Always import icons by name (never barrel-import):

```tsx
import { Send, Bot, User, Settings, X, ChevronDown } from "lucide-react"

// Use as React components
<Send className="size-4" />
<Bot className="size-5 text-accent" />
```

### Chrome Extension note

No special config needed. lucide-react ships pure ESM SVG components — Vite tree-shakes them correctly and they render inline in the side-panel page.

---

## 4. State Management — Zustand

### Why Zustand over Jotai or Context

| | Context | Jotai | Zustand |
|---|---|---|---|
| Mental model | React-native, top-down | Atomic, bottom-up | Single store, module-first |
| Re-render granularity | Poor (whole tree) | Excellent (per-atom) | Good (per-selector) |
| Chrome extension fit | Poor (no cross-context) | Medium | Excellent |
| Async storage integration | Manual | Manual | Built-in persist middleware |
| DevTools | None | Jotai DevTools | Redux DevTools |
| Bundle size | 0 (built-in) | ~3 KB | ~1.1 KB |

For a chat agent with complex, interconnected state (messages, agent status, tool calls, settings), Zustand's single-store model is easier to reason about and extend. Jotai's atomic model shines for fine-grained UI state but requires more boilerplate for shared cross-component logic.

**Critical Chrome Extension constraint:** the side panel, background service worker, and content scripts run in isolated JavaScript contexts — they cannot share in-memory state. Zustand's `persist` middleware + `chrome.storage` bridges this gap.

### Install

```bash
bun add zustand
```

### Chrome storage persistence

Use `zustand-chrome-storage` to persist the store across the Chrome extension's isolated contexts:

```bash
bun add zustand-chrome-storage
```

Example store pattern for a chat agent:

```ts
// src/store/chat.ts
import { create } from "zustand"
import { persist } from "zustand/middleware"
import { ChromeLocalStorage } from "zustand-chrome-storage"

export type Role = "user" | "assistant" | "tool"

export interface Message {
  id: string
  role: Role
  content: string
  timestamp: number
  isStreaming?: boolean
}

interface ChatStore {
  messages: Message[]
  isAgentRunning: boolean
  addMessage: (msg: Message) => void
  updateLastMessage: (content: string) => void
  setAgentRunning: (v: boolean) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      messages: [],
      isAgentRunning: false,
      addMessage: (msg) =>
        set((s) => ({ messages: [...s.messages, msg] })),
      updateLastMessage: (content) =>
        set((s) => {
          const msgs = [...s.messages]
          if (msgs.length > 0) msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content }
          return { messages: msgs }
        }),
      setAgentRunning: (v) => set({ isAgentRunning: v }),
      clearMessages: () => set({ messages: [] }),
    }),
    {
      name: "chat-storage",
      storage: ChromeLocalStorage,
    }
  )
)
```

### Hydration note

Because `chrome.storage` is asynchronous, the store will not be hydrated at the initial render. Use `useHydration` or `onRehydrateStorage` to show a loading state until the store is ready.

---

## 5. Animations — Motion for React (formerly Framer Motion)

### Why

Motion for React (the library formerly known as Framer Motion, now imported from `motion/react`) is the best choice for a chat UI in a React extension:

- Hardware-accelerated via WAAPI — smooth 60fps on Chrome
- Exit animations (`AnimatePresence`) for message fade-in/out — not possible with CSS alone
- Spring-based physics for natural typing indicator and panel transitions
- Layout animations for chat message height changes
- Stagger animations for streaming tokens

Alternatives:
- **CSS transitions only**: feasible for simple opacity fades but no exit animations, no springs, harder to coordinate
- **react-spring**: good physics engine, steeper learning curve, less intuitive API for list animations

### Bundle size

Motion is ~34 KB (full). Use `LazyMotion` + `m` component to reduce initial bundle to ~4.6 KB:

```tsx
import { LazyMotion, domAnimation, m } from "motion/react"

// Wrap your app root:
<LazyMotion features={domAnimation}>
  <App />
</LazyMotion>

// Use m instead of motion:
<m.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -4 }}
>
  {message.content}
</m.div>
```

### Install

```bash
bun add motion
```

Note: the package is now `motion`, not `framer-motion`. Import from `motion/react`.

### Patterns for chat UI

```tsx
import { AnimatePresence, LazyMotion, domAnimation, m } from "motion/react"

// Animate new messages entering
<AnimatePresence initial={false}>
  {messages.map((msg) => (
    <m.div
      key={msg.id}
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <ChatMessage message={msg} />
    </m.div>
  ))}
</AnimatePresence>

// Typing indicator dots
<m.div
  animate={{ opacity: [0.4, 1, 0.4] }}
  transition={{ duration: 1.2, repeat: Infinity }}
/>
```

---

## 6. Chat UI Utilities

### 6a. Markdown rendering — react-markdown + remark-gfm

For rendering AI assistant responses with GFM (tables, task lists, strikethrough):

```bash
bun add react-markdown remark-gfm
```

Usage:

```tsx
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

<ReactMarkdown remarkPlugins={[remarkGfm]}>
  {message.content}
</ReactMarkdown>
```

**Streaming note:** react-markdown re-renders on every content update, which is fine for streaming token-by-token if you throttle updates (e.g. update state every 50ms rather than every token). For a more robust streaming solution, consider `streamdown` (see below).

### 6b. Streaming AI markdown — streamdown (optional upgrade)

`streamdown` is a drop-in `react-markdown` replacement specifically designed for AI streaming responses. It handles incomplete/unterminated Markdown blocks gracefully:

```bash
bun add streamdown
```

```tsx
import Streamdown from "streamdown"
import remarkGfm from "remark-gfm"

<Streamdown remarkPlugins={[remarkGfm]}>
  {streamingContent}
</Streamdown>
```

Requires React 19. If staying on React 18, use `react-markdown` with a debounced state update pattern.

### 6c. Syntax highlighting — react-shiki

`react-shiki` wraps Shiki (the same highlighter VS Code uses) as a React component and hook. It supports streaming code blocks natively:

```bash
bun add react-shiki
```

Usage with react-markdown:

```tsx
import { ShikiHighlighter } from "react-shiki"
import ReactMarkdown from "react-markdown"

<ReactMarkdown
  components={{
    code({ node, className, children, ...props }) {
      const lang = /language-(\w+)/.exec(className || "")?.[1]
      if (!lang) return <code className={className} {...props}>{children}</code>
      return (
        <ShikiHighlighter language={lang} theme="github-dark">
          {String(children).replace(/\n$/, "")}
        </ShikiHighlighter>
      )
    },
  }}
>
  {content}
</ReactMarkdown>
```

**Bundle size note:** Shiki loads language grammars lazily. For a chat agent you likely only need `javascript`, `typescript`, `python`, `bash`, `json` — configure the language list to keep the bundle small.

### 6d. Auto-scroll hook

For chat UIs that must scroll to the latest message, write a small hook (no library needed):

```ts
// src/hooks/useAutoScroll.ts
import { useEffect, useRef } from "react"

export function useAutoScroll(deps: unknown[]) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth" })
  }, deps)
  return ref
}
```

---

## 7. Build Tooling — Vite + Manual Multi-Entry

### Current setup vs. framework plugins

The project currently uses a manual Vite multi-entry setup (`rollupOptions.input`). Three options exist for Chrome extension build tooling:

| Option | Complexity | HMR | MV3 support | Bun support | Verdict |
|---|---|---|---|---|---|
| **Manual Vite** (current) | Low | No | Yes | Yes | Good for simple layouts |
| **vite-plugin-web-extension** | Medium | Partial | Yes | Yes | Solid, entering maintenance |
| **WXT** | Medium | Yes | Yes | Yes | Best long-term choice |
| **CRXJS** | Medium | Yes | Yes (v2) | Partial | History of instability |

**Recommendation: stay with the current manual Vite setup for now.** The project has a single entry (side panel), a background service worker that's already a separate file, and no content scripts injected yet. The manual setup has zero framework overhead.

If/when the project adds multiple content scripts, options pages, and a dev-mode hot-reload requirement, migrate to **WXT**:

```bash
# WXT supports Bun
bunx wxt@latest init
```

WXT is described as "Vite for browser extensions" — it auto-generates the manifest from file structure, supports MV3, and has first-class React + TypeScript support.

### Current build script fix

The existing `build` script manually copies `manifest.json` and `background.js`:

```json
"build": "tsc && vite build && cp manifest.json background.js dist/ && mkdir -p dist/icons && cp icons/*.png dist/icons/"
```

This is fine but note: `background.js` is a handwritten file, not Vite-compiled. Consider adding it as a Vite input entry if it needs TypeScript or imports:

```ts
// vite.config.ts rollupOptions.input
input: {
  sidepanel: path.resolve(__dirname, "sidepanel.html"),
  background: path.resolve(__dirname, "src/background.ts"),  // if migrating background.js
},
```

---

## 8. DX Utilities

### 8a. TypeScript config — already good

The existing `tsconfig.json` already has `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, and `moduleResolution: "bundler"`. These are correct settings.

**Additions to consider:**

```json
{
  "compilerOptions": {
    // Add these to existing config:
    "noImplicitReturns": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true
  }
}
```

`noUncheckedIndexedAccess` is particularly useful for a chat agent — it forces you to handle `undefined` when accessing array elements by index (e.g., `messages[0]` returns `Message | undefined`).

### 8b. Chrome extension types

```bash
bun add -d @types/chrome
```

This gives full TypeScript types for all Chrome APIs (`chrome.storage`, `chrome.sidePanel`, `chrome.tabs`, etc.):

```ts
// Fully typed
await chrome.storage.local.set({ key: "value" })
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
```

### 8c. Path aliases — already configured

The `@` alias is already set in both `vite.config.ts` and `tsconfig.json`. No changes needed.

Suggested directory structure to make full use of the alias:

```
src/
  components/
    ui/           # shadcn/ui components (generated by CLI)
    chat/         # chat-specific components (ChatMessage, ChatInput, etc.)
    agent/        # agent status, tool call display
  hooks/          # useAutoScroll, useStreamingText, etc.
  store/          # zustand stores
  lib/
    utils.ts      # cn() helper
    chrome.ts     # typed chrome API wrappers
  types/          # shared TypeScript types
```

### 8d. Formatting — Biome (optional, replaces ESLint + Prettier)

For a fast, zero-config formatter and linter that works well with Bun:

```bash
bun add -d @biomejs/biome
bunx biome init
```

Biome is ~10x faster than ESLint + Prettier and uses a single config file (`biome.json`). It has first-class TypeScript and JSX support.

If you prefer to keep ESLint (already implied by the Vite scaffold), no changes needed — the default config is fine.

---

## Full install sequence

Run these commands in order from the project root:

```bash
# 1. Upgrade Tailwind to v4
bun remove tailwindcss autoprefixer postcss
bun add -d tailwindcss @tailwindcss/vite

# 2. Chrome extension types
bun add -d @types/chrome

# 3. shadcn/ui peer dependencies (CLI will also add these, listed for clarity)
bun add clsx tailwind-merge class-variance-authority @radix-ui/react-slot

# 4. shadcn/ui CLI init (interactive)
bunx shadcn@latest init

# 5. Add starter shadcn components for chat UI
bunx shadcn@latest add button input textarea scroll-area badge separator tooltip

# 6. Icons
bun add lucide-react

# 7. State management + Chrome storage persistence
bun add zustand zustand-chrome-storage

# 8. Animations
bun add motion

# 9. Markdown + syntax highlighting
bun add react-markdown remark-gfm react-shiki

# 10. (Optional) Biome for formatting
bun add -d @biomejs/biome && bunx biome init
```

---

## Decision log

| Decision | Rejected alternative | Reason |
|---|---|---|
| shadcn/ui | MUI, Chakra | Copy-owned components, no runtime dep, matches Radix/Tailwind stack |
| Tailwind v4 | Stay on v3 | shadcn CLI now targets v4; v4 Vite plugin is faster than PostCSS |
| lucide-react | react-icons, Heroicons | Official shadcn icon lib; best per-icon bundle size at scale |
| Zustand | Jotai, Redux | Single store fits chat agent model; best `chrome.storage` persist story |
| motion/react | CSS transitions, react-spring | Exit animations + springs not possible in CSS; simpler API than react-spring |
| react-markdown | marked, mdx | Most flexible plugin ecosystem; works with react-shiki and remark-gfm |
| react-shiki | Prism, highlight.js | Shiki uses VS Code grammars; streaming-aware; better visual quality |
| Manual Vite | WXT, CRXJS | Single entry point today; migrate to WXT when multiple entries needed |
