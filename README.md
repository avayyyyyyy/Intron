# Pavo

AI chat assistant in a Chrome side panel. Streaming responses, reasoning, tool calling — powered by OpenRouter and the Vercel AI SDK.

## Features

- **Side panel UI** — persistent chat pinned to the browser, works across tabs
- **Streaming** — real-time token-by-token response via SSE
- **Reasoning** — live thinking display for models that support it (auto-expands while streaming, collapses when text starts)
- **Tool calling** — extensible tool infrastructure with `getTime` as the first example
- **Model selector** — switch between models from the input bar
- **Copy to clipboard** — hover any message to copy
- **Dark theme** — Geist fonts, accent colors, smooth animations

## Setup

### Prerequisites

- [Bun](https://bun.sh/) (or npm/yarn)
- [OpenRouter](https://openrouter.ai/) API key

### Install

```bash
bun install
```

### Build

```bash
bun run build
```

Output goes to `dist/`.

### Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dist/` folder
5. Click the extension icon or press `Ctrl+Shift+X` to open the side panel

### Configure

1. Open the side panel
2. Click the gear icon (Settings)
3. Paste your OpenRouter API key
4. Save — you're ready to chat

## Usage

**Chat** — type a message and press Enter. Responses stream in real time.

**Switch models** — use the dropdown below the input to pick a model. Changes persist.

**Reasoning** — use a thinking-capable model (e.g., Gemini Flash, Claude with extended thinking). The "Thinking" toggle auto-opens during streaming and collapses when the model starts responding. Click to review after.

**Tools** — ask "What time is it?" to trigger the `getTime` tool. Tool cards show execution state and results.

**New chat** — click the `+` button in the header to clear the conversation.

## Architecture

```
src/
├── background.ts          # Service worker — tab tracking, side panel config
├── App.tsx                # Root — view routing (chat / settings)
├── components/
│   ├── ChatView.tsx       # Message list + input + header controls
│   ├── ChatMessage.tsx    # Single message — markdown, reasoning, tools, copy
│   ├── ChatInput.tsx      # Textarea + send + model selector
│   └── SettingsView.tsx   # API key input
├── hooks/
│   └── useStreamingChat.ts # AI SDK streamText + fullStream handler
├── lib/
│   ├── tools.ts           # Tool definitions (getTime, extendable)
│   ├── models.ts          # OpenRouter model list
│   └── settings.ts        # chrome.storage.sync wrapper
├── store/
│   ├── chat.ts            # Zustand store — messages, streaming state
│   └── types.ts           # Message, ToolInvocation, ChatStoreState
└── index.css              # Tailwind v4 + custom design tokens
```

### Key decisions

- **Vercel AI SDK** (`streamText` + `@openrouter/ai-sdk-provider`) — handles streaming, tool execution, and multi-step loops. No custom SSE parsing needed.
- **Zustand** — lightweight state management for messages and streaming flags.
- **Chrome side panel** — persistent UI without popup limitations. Tab-scoped state via background service worker.
- **No backend** — OpenRouter allows CORS from browsers. API key stored in `chrome.storage.sync`. Everything runs client-side.

## Adding tools

Define a tool in `src/lib/tools.ts`:

```typescript
import { tool } from "ai";
import { z } from "zod";

export const agentTools = {
  existingTool: tool({ ... }),

  myNewTool: tool({
    description: "What this tool does",
    inputSchema: z.object({
      param: z.string().describe("Description of param"),
    }),
    execute: async ({ param }) => {
      return { result: "..." };
    },
  }),
};
```

The AI SDK handles tool detection, execution, and result injection automatically. The model sees the result and can incorporate it into its response.

## Tech stack

| Layer      | Library                                       |
| ---------- | --------------------------------------------- |
| UI         | React 18, TypeScript                          |
| State      | Zustand                                       |
| AI         | Vercel AI SDK v6, @openrouter/ai-sdk-provider |
| Validation | Zod                                           |
| Styling    | Tailwind CSS v4, Geist fonts                  |
| Build      | Vite 6, Bun                                   |
| Icons      | Lucide React                                  |

## License

Private
