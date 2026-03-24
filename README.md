<p align="center">
  <img src="apps/extension/icons/icon128.png" width="80" />
</p>

<h1 align="center">Intron</h1>

<p align="center">
  <strong>An AI agent that lives in your browser.</strong><br/>
  <sub>Reads pages. Clicks buttons. Fills forms. Navigates sites. All from a side panel — with your real browser session.</sub>
</p>

<p align="center">
  <a href="https://github.com/avayyyyyyy/intron/"><img src="https://img.shields.io/github/stars/user/exten-agent?style=flat&color=orange" alt="GitHub stars" /></a>
  <a href="https://github.com/avayyyyyyy/intron/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License" /></a>
  <a href="https://openrouter.ai/"><img src="https://img.shields.io/badge/models-OpenRouter-blueviolet" alt="OpenRouter" /></a>
</p>

---

<img width="1800" height="947" alt="Intron side panel demo" src="https://github.com/user-attachments/assets/c7d7969c-fa5a-4b41-9188-beb00d11c0f1" />

---

## Why Intron?

Most AI browser agents run in a sandbox — a headless browser you can't see, can't control, and that doesn't have your logins. Intron takes the opposite approach.

- **Real browser, not a sandbox.** Intron runs as a Chrome extension in your actual browser — with your cookies, your sessions, your context. No headless anything.
- **You watch it work.** Every action streams live in the side panel. You see what it's doing, why, and can stop it anytime.
- **Open source. Bring your own key.** Your API key talks directly to OpenRouter. No backend, no middleman, no data leaves your machine except the API calls you control.
- **Any model.** Switch between Gemini, GPT, Qwen, MiniMax, and others via OpenRouter. One extension, 12+ models.
- **18 real browser tools.** Not just chat. Intron clicks buttons, fills forms, extracts data, takes screenshots, navigates pages, and chains multi-step workflows.

## Get started in 60 seconds

### Option A: Build from source

```bash
git clone https://github.com/avayyyyyyy/intron.git && cd intron
bun install && bun run build:ext
```

Then load `apps/extension/dist/` as an unpacked extension in `chrome://extensions` (Developer mode on).

### Option B: Download the latest release

> Coming soon — Chrome Web Store listing in progress.

### Configure

1. Click the Intron icon (or press **Ctrl+Shift+X**) to open the side panel
2. Open Settings, paste your [OpenRouter API key](https://openrouter.ai/keys)
3. Pick a model, start chatting

No server. No Docker. No config files.

## What can it do?

**Browse for you** — "Go to Amazon and find the cheapest USB-C hub with at least 4 ports."

**Fill forms** — "Fill out the job application on this page with my info: [name, email, etc.]"

**Extract data** — "Scrape every product name and price from this search results page."

**Read & summarize** — "Summarize the key points of this article."

**Multi-step workflows** — "Log into my dashboard, go to settings, change my display name to Alex, and save."

Every action happens in your real browser. Intron sees what you see.

## Features

**Streaming responses** — real-time token-by-token display. No waiting for a full plan.

**Reasoning display** — live thinking for models that support it. Auto-expands while the model thinks, collapses when text starts.

**18 browser tools** — screenshots, navigation, clicking, typing, scrolling, form filling, data extraction, DOM inspection, and more. All callable by the AI, all visible in the side panel.

**Tab-scoped conversations** — each tab gets its own chat context. Switch tabs, switch conversations.

**Multi-model support** — Gemini 3.1 Flash Lite, GPT-5.4 Nano, Qwen3 Coder, MiniMax M2.7, Nemotron 120B, and more via OpenRouter.

**Vision-capable** — models with vision can see your screen via screenshots and make decisions based on what they see.

**Production-grade safety** — comprehensive prompt injection defense, social engineering resistance, credential handling restrictions, and a three-tier action classification system (prohibited / requires permission / automatic).

**Dark mode** — Geist fonts, polished UI, smooth animations.

## How it works

```
Chrome Extension (Manifest V3)
├── Side Panel (React + Zustand)        ← You chat here
│   ├── Streaming via Vercel AI SDK     ← Tokens arrive in real-time
│   └── Tool calls render as cards      ← You see every action
├── Background Service Worker            ← Manages tabs, routes messages
│   ├── Tab group management            ← Each session gets its own group
│   └── Tool execution handlers         ← 18 browser automation tools
└── Content Scripts (ISOLATED world)     ← DOM access on any page
    ├── Click, type, scroll, extract    ← Real browser interactions
    └── execCommand for React compat    ← Works with any framework
```

Your API key goes directly to OpenRouter via CORS. No backend server, no proxy, nothing in between.

## Tools reference

| Category | Tools |
|----------|-------|
| **Observe** | `getScreenshot` `getPageContent` `getPageStructure` `getElementInfo` `getPageLinks` |
| **Navigate** | `navigateTo` `goBack` `goForward` `reloadPage` |
| **Interact** | `clickElement` `typeText` `pressKey` `hoverElement` `scrollPage` |
| **Forms** | `fillForm` `selectOption` |
| **Extract** | `extractData` |
| **Wait** | `waitForElement` |
| **Advanced** | `executeScript` (12 parameterized DOM operations, no eval) |

All tools return structured results the AI uses to decide its next step. Vision models also get screenshots for visual reasoning.

## Extending Intron

Add a tool in `apps/extension/src/lib/tools.ts`:

```typescript
import { tool } from "ai";
import { z } from "zod";

const myTool = tool({
  description: "What this tool does — one line",
  inputSchema: z.object({
    param: z.string().describe("What this param is for"),
  }),
  execute: async ({ param }) => {
    return { result: "..." };
  },
});
```

Add the handler in `background.ts`, add the tool to the `agentTools` export, done. The AI SDK handles detection, execution, and result injection automatically.

## Tech stack

| Layer | Library |
|-------|---------|
| UI | React 18, TypeScript, Tailwind CSS v4 |
| State | Zustand v5 |
| AI | Vercel AI SDK v6, @openrouter/ai-sdk-provider |
| Validation | Zod |
| Fonts | Geist (sans + mono) |
| Icons | Lucide React |
| Build | Vite 6, Bun monorepo |
| Components | Radix UI primitives |

## Project structure

```
apps/
├── extension/              # Chrome Extension (this is the product)
│   ├── src/
│   │   ├── background.ts   # Service worker — tool execution, tab management
│   │   ├── components/      # React UI — chat, settings, message rendering
│   │   ├── hooks/           # useStreamingChat — AI SDK integration
│   │   ├── lib/             # agent.ts (prompt), tools.ts, models.ts, settings.ts
│   │   └── store/           # Zustand — messages, streaming state, conversations
│   └── manifest.json        # MV3 — sidePanel, tabs, scripting permissions
└── website/                 # Landing page (Next.js, in progress)
```

## Roadmap

- [ ] Chrome Web Store listing
- [ ] Console & network debugging tools (diagnose why actions fail)
- [ ] Natural language element finder ("click the login button")
- [ ] Stable element ref system (survives scrolls and layout shifts)
- [ ] Multi-tab support (research across tabs in parallel)
- [ ] Task/plan management UI (visual progress tracking)
- [ ] One-click recording → replayable workflows

## Contributing

Contributions welcome. If you're fixing a bug or adding a tool, open a PR. For larger changes, open an issue first so we can discuss the approach.

```bash
bun install          # install deps
bun run dev:ext      # dev mode with hot reload
bun run build:ext    # production build
```

## License

MIT
