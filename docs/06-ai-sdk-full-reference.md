# AI SDK v6 — Full Server-Side Reference

> **Scope:** This document covers the Vercel AI SDK (v6) for server-side use — Node.js, Edge Runtime, Hono, Next.js App Router. It assumes a backend exists.
>
> For the browser-only (no backend) approach used by this Chrome extension's side panel, see `docs/03-ai-sdk-openrouter-setup.md`.
>
> All code in this document is TypeScript and runs **server-side only** unless explicitly noted.

---

> **v6 Breaking Changes at a Glance**
>
> | Old API (v4/v5) | New API (v6) |
> |---|---|
> | `generateObject` / `streamObject` | `generateText` / `streamText` with `output` option |
> | `tool({ parameters: z.object({...}) })` | `tool({ inputSchema: z.object({...}) })` |
> | `maxSteps: N` | `stopWhen: stepCountIs(N)` |
> | Manual agent loop | `ToolLoopAgent` class |
> | `UIMessage` = `ModelMessage` | `UIMessage` vs `ModelMessage` are separate; use `convertToModelMessages()` |
> | `toAIStreamResponse()` | `toUIMessageStreamResponse()` |
> | No `Output.*` namespace | `Output.object()`, `Output.array()`, `Output.choice()`, `Output.json()`, `Output.text()` |

---

## 1. Setup & Configuration

### Install

```bash
# Core AI SDK
bun add ai

# OpenRouter provider (recommended path)
bun add @openrouter/ai-sdk-provider

# Alternative: use @ai-sdk/openai with baseURL override
bun add @ai-sdk/openai

# Schema validation (required for tools and structured output)
bun add zod
```

### Path 1 — Official OpenRouter Provider

```ts
// lib/ai.ts
import { createOpenRouter } from "@openrouter/ai-sdk-provider"

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
  // Optional: identify your app on openrouter.ai/activity
  headers: {
    "HTTP-Referer": "https://yourapp.com",
    "X-Title": "Your App Name",
  },
})

// Usage: openrouter.chat("anthropic/claude-3-5-sonnet")
```

### Path 2 — `@ai-sdk/openai` with BaseURL Override

```ts
// lib/ai.ts (alternative)
import { createOpenAI } from "@ai-sdk/openai"

export const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: "https://openrouter.ai/api/v1",
})

// Usage: openrouter("anthropic/claude-3-5-sonnet")
// Note: use openrouter.chat("...") for chat models explicitly
```

### Environment Variables

```bash
# .env (server-side; never ship to browser)
OPENROUTER_API_KEY=sk-or-v1-...

# Optional cost controls
OPENROUTER_MAX_COST=0.10    # max spend per request in USD (not enforced by SDK — app logic)
```

> **SERVER-ONLY WARNING:** Never expose `OPENROUTER_API_KEY` to a browser bundle. In Next.js, only use this in `app/api/` routes or Server Components. In a Chrome extension, this means a separate backend is required — the side panel cannot use any code from this document.

---

## 2. `generateText` & `streamText`

### `generateText` — Full Parameters

```ts
import { generateText } from "ai"
import { openrouter } from "./lib/ai"

const result = await generateText({
  model: openrouter.chat("anthropic/claude-3-5-sonnet"),

  // Messages (use ModelMessage format — see Section 6 for UIMessage conversion)
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "What is 2 + 2?" },
  ],

  // OR use prompt shorthand (sets a single user message)
  // prompt: "What is 2 + 2?",

  // Generation controls
  maxTokens: 1024,
  temperature: 0.7,         // 0 = deterministic, 1 = creative
  topP: 0.9,
  frequencyPenalty: 0,
  presencePenalty: 0,

  // Agent controls (v6)
  stopWhen: stepCountIs(5), // replaces maxSteps: 5

  // Callbacks
  onStepFinish: async ({ text, toolCalls, toolResults, usage }) => {
    console.log("Step finished:", { text, usage })
  },
})

console.log(result.text)
console.log(result.usage)       // { promptTokens, completionTokens, totalTokens }
console.log(result.finishReason) // "stop" | "length" | "tool-calls" | "error"
console.log(result.steps)       // all intermediate steps (multi-step tool use)
```

### `streamText` — Parameters and Stream Consumption

```ts
import { streamText } from "ai"
import { openrouter } from "./lib/ai"

const stream = streamText({
  model: openrouter.chat("google/gemini-2.0-flash-exp"),
  messages,
  maxTokens: 2048,
  stopWhen: stepCountIs(10),

  onChunk: ({ chunk }) => {
    // Called for every chunk — useful for logging or rate-limiting
    if (chunk.type === "text-delta") process.stdout.write(chunk.textDelta)
  },

  onFinish: async ({ text, usage, finishReason, steps }) => {
    // Called once when the full stream completes
    await db.saveCompletion({ text, usage })
  },

  onStepFinish: async ({ text, toolCalls, toolResults }) => {
    // Called after each agentic step (tool call round-trip)
  },
})

// Pattern 1: consume text only
for await (const delta of stream.textStream) {
  process.stdout.write(delta)
}

// Pattern 2: consume full stream with event types
for await (const chunk of stream.fullStream) {
  switch (chunk.type) {
    case "text-delta":    console.log(chunk.textDelta); break
    case "tool-call":     console.log("Calling:", chunk.toolName); break
    case "tool-result":   console.log("Result:", chunk.result); break
    case "finish":        console.log("Done:", chunk.finishReason); break
    case "error":         console.error("Error:", chunk.error); break
  }
}

// Pattern 3: await final result after streaming
const { text, usage } = await stream.response
```

### `streamText` — HTTP Response (Next.js / Hono)

```ts
// Next.js App Router: app/api/chat/route.ts
import { streamText } from "ai"
import { openrouter } from "@/lib/ai"

export async function POST(req: Request) {
  const { messages } = await req.json()

  const stream = streamText({
    model: openrouter.chat("anthropic/claude-3-5-sonnet"),
    messages,
  })

  // toUIMessageStreamResponse() replaces the old toAIStreamResponse()
  return stream.toUIMessageStreamResponse()
}
```

```ts
// Hono: src/routes/chat.ts
import { Hono } from "hono"
import { streamText } from "ai"
import { openrouter } from "../lib/ai"

const chat = new Hono()

chat.post("/", async (c) => {
  const { messages } = await c.req.json()

  const stream = streamText({
    model: openrouter.chat("anthropic/claude-3-5-sonnet"),
    messages,
  })

  return stream.toUIMessageStreamResponse()
})

export default chat
```

---

## 3. Tool Use

### Defining a Tool — `inputSchema` (v6 rename from `parameters`)

```ts
import { tool } from "ai"
import { z } from "zod"

// Tool WITH execute (auto-run server-side)
const getWeather = tool({
  description: "Get current weather for a location",
  inputSchema: z.object({
    location: z.string().describe("City and country, e.g. 'London, UK'"),
    units: z.enum(["celsius", "fahrenheit"]).default("celsius"),
  }),
  execute: async ({ location, units }) => {
    const data = await fetchWeatherAPI(location, units)
    return { temperature: data.temp, condition: data.condition }
  },
})

// Tool WITHOUT execute (caller handles execution — used for browser/computer-use tools)
const clickElement = tool({
  description: "Click a DOM element by CSS selector",
  inputSchema: z.object({
    selector: z.string().describe("CSS selector for the element to click"),
  }),
  // No execute — the model returns a tool-call, caller executes it
})
```

### `toolChoice` — Control Which Tools Are Called

```ts
await generateText({
  model: openrouter.chat("anthropic/claude-3-5-sonnet"),
  tools: { getWeather, searchWeb },
  toolChoice: "auto",       // default — model decides
  // toolChoice: "required"  // model MUST call a tool
  // toolChoice: "none"      // model MUST NOT call tools
  // toolChoice: { type: "tool", toolName: "getWeather" }  // force specific tool
  messages,
})
```

### `stopWhen: stepCountIs(N)` — Multi-Step Agentic Tool Use

```ts
import { generateText, stepCountIs } from "ai"

// Allow up to 5 tool call rounds before stopping
const result = await generateText({
  model: openrouter.chat("anthropic/claude-3-5-sonnet"),
  tools: { getWeather, searchWeb },
  stopWhen: stepCountIs(5),  // v6 — replaces maxSteps: 5
  messages: [{ role: "user", content: "What is the weather in Paris and London?" }],
})

// Inspect all steps
for (const step of result.steps) {
  console.log("Step text:", step.text)
  console.log("Tool calls:", step.toolCalls)
  console.log("Tool results:", step.toolResults)
}
```

### Complete 2-Tool Example

```ts
import { generateText, tool, stepCountIs } from "ai"
import { z } from "zod"
import { openrouter } from "./lib/ai"

const searchWeb = tool({
  description: "Search the web for current information",
  inputSchema: z.object({
    query: z.string().describe("Search query"),
  }),
  execute: async ({ query }) => {
    // Replace with real search API (Tavily, Brave, etc.)
    const results = await fetch(`https://api.tavily.com/search?q=${query}`)
    return results.json()
  },
})

const calculator = tool({
  description: "Evaluate a mathematical expression",
  inputSchema: z.object({
    expression: z.string().describe("Math expression to evaluate, e.g. '2 * (3 + 4)'"),
  }),
  execute: async ({ expression }) => {
    // Caution: eval is used here for brevity — use a safe math parser in production
    try {
      return { result: Function(`"use strict"; return (${expression})`)() }
    } catch {
      return { error: "Invalid expression" }
    }
  },
})

const result = await generateText({
  model: openrouter.chat("anthropic/claude-3-5-sonnet"),
  tools: { searchWeb, calculator },
  toolChoice: "auto",
  stopWhen: stepCountIs(8),
  messages: [
    {
      role: "user",
      content: "Search for the current Bitcoin price and multiply it by 0.001",
    },
  ],
})

console.log(result.text)
console.log(`Completed in ${result.steps.length} steps`)
```

---

## 4. Agent Patterns

### `ToolLoopAgent` — New in v6

```ts
import { ToolLoopAgent, stepCountIs } from "ai"
import { openrouter } from "./lib/ai"

const agent = new ToolLoopAgent({
  model: openrouter.chat("anthropic/claude-3-5-sonnet"),
  tools: { searchWeb, calculator, getWeather },

  // Stop conditions (can combine multiple)
  stopWhen: stepCountIs(20),

  // Called before each step — can modify messages or inject context
  prepareStep: async ({ messages, stepNumber }) => {
    console.log(`Starting step ${stepNumber} with ${messages.length} messages`)
    // Return modified messages or undefined to use as-is
    return undefined
  },

  // Called after each step — useful for logging/persistence
  onStepFinish: async ({ text, toolCalls, toolResults, usage }) => {
    await db.saveAgentStep({ text, toolCalls, toolResults, usage })
  },
})

// Run the agent
const result = await agent.run({
  messages: [{ role: "user", content: "Research and summarize the latest AI news" }],
})

console.log(result.text)
console.log(result.totalUsage) // aggregated across all steps
```

### `stopWhen` — Custom Stop Conditions

```ts
import { stepCountIs, hasToolCall, lastMessage } from "ai"

// Built-in stop conditions
stopWhen: stepCountIs(10)                    // stop after 10 steps
stopWhen: hasToolCall("submitAnswer")         // stop when model calls a specific tool
stopWhen: lastMessage({ role: "assistant" })  // stop after assistant responds

// Combine with logical operators
import { and, or, not } from "ai"
stopWhen: or(stepCountIs(10), hasToolCall("submitAnswer"))
```

### `prepareStep` — Dynamic Context Injection

```ts
const agent = new ToolLoopAgent({
  model: openrouter.chat("anthropic/claude-3-5-sonnet"),
  tools,
  stopWhen: stepCountIs(15),

  prepareStep: async ({ messages, stepNumber, previousStepResult }) => {
    // Inject fresh context before each step
    const systemMessage = {
      role: "system" as const,
      content: `Step ${stepNumber}/15. Current time: ${new Date().toISOString()}`,
    }
    // Return updated messages with injected context
    return [systemMessage, ...messages.filter(m => m.role !== "system")]
  },
})
```

### Manual ReAct Loop Pattern

For cases where `ToolLoopAgent` does not fit (e.g. custom stop logic, streaming with tool execution):

```ts
import { streamText, tool, stepCountIs } from "ai"
import { z } from "zod"

async function runReActAgent(userQuery: string) {
  const messages: ModelMessage[] = [
    { role: "system", content: "Think step by step. Use tools to gather information." },
    { role: "user", content: userQuery },
  ]

  let stepCount = 0
  const MAX_STEPS = 10

  while (stepCount < MAX_STEPS) {
    stepCount++

    const stream = streamText({
      model: openrouter.chat("anthropic/claude-3-5-sonnet"),
      tools: { searchWeb, calculator },
      toolChoice: "auto",
      messages,
    })

    let assistantText = ""
    const toolCallsThisStep: ToolCall[] = []

    for await (const chunk of stream.fullStream) {
      if (chunk.type === "text-delta") assistantText += chunk.textDelta
      if (chunk.type === "tool-call") toolCallsThisStep.push(chunk)
      if (chunk.type === "finish" && chunk.finishReason === "stop") {
        // Model is done — no more tool calls
        messages.push({ role: "assistant", content: assistantText })
        return assistantText
      }
    }

    // Process tool calls and add results to messages
    if (toolCallsThisStep.length > 0) {
      messages.push({ role: "assistant", content: assistantText, toolCalls: toolCallsThisStep })

      const toolResults = await Promise.all(
        toolCallsThisStep.map(async (call) => {
          const fn = tools[call.toolName as keyof typeof tools]
          const result = await fn.execute?.(call.args) ?? { error: "No executor" }
          return { toolCallId: call.toolCallId, result }
        })
      )

      messages.push({ role: "tool", content: toolResults })
    }
  }

  throw new Error("Max steps reached without a final answer")
}
```

---

## 5. Structured Output

### `Output.*` Namespace — v6

```ts
import { generateText, Output } from "ai"
import { z } from "zod"

// Output.object() — generate a typed object
const result = await generateText({
  model: openrouter.chat("anthropic/claude-3-5-sonnet"),
  output: Output.object({
    schema: z.object({
      title: z.string(),
      summary: z.string(),
      tags: z.array(z.string()),
      sentiment: z.enum(["positive", "neutral", "negative"]),
    }),
  }),
  prompt: "Analyze this article: ...",
})

console.log(result.object.title)    // fully typed
console.log(result.object.tags)     // string[]
```

```ts
// Output.array() — generate a typed array
const result = await generateText({
  model: openrouter.chat("anthropic/claude-3-5-sonnet"),
  output: Output.array({
    schema: z.object({
      name: z.string(),
      email: z.string().email(),
    }),
  }),
  prompt: "Extract all contacts from this text: ...",
})

console.log(result.object) // Array<{ name: string; email: string }>
```

```ts
// Output.choice() — constrained enum selection
const result = await generateText({
  model: openrouter.chat("anthropic/claude-3-5-sonnet"),
  output: Output.choice(["book_flight", "check_weather", "search_hotels", "none"]),
  prompt: "User said: 'I need to get to Paris next week'. Intent?",
})

console.log(result.object) // "book_flight" | "check_weather" | "search_hotels" | "none"
```

```ts
// Output.json() — untyped JSON (use when schema is dynamic)
const result = await generateText({
  model: openrouter.chat("anthropic/claude-3-5-sonnet"),
  output: Output.json(),
  prompt: "Return a JSON object describing a random city",
})

console.log(result.object) // unknown — cast as needed
```

### Streaming Structured Output — `partialOutputStream`

```ts
import { streamText, Output } from "ai"
import { z } from "zod"

const stream = streamText({
  model: openrouter.chat("anthropic/claude-3-5-sonnet"),
  output: Output.object({
    schema: z.object({
      headline: z.string(),
      body: z.string(),
      sources: z.array(z.string()),
    }),
  }),
  prompt: "Write a news article about the Mars mission.",
})

// Receive partial objects as they stream in
for await (const partial of stream.partialOutputStream) {
  // partial is DeepPartial<{ headline, body, sources }>
  if (partial.headline) console.log("Headline:", partial.headline)
  if (partial.body) process.stdout.write(partial.body)
}

const { object } = await stream.response
console.log("Final:", object.sources)
```

### `NoObjectGeneratedError` — Handling Failures

```ts
import { generateText, Output, NoObjectGeneratedError } from "ai"

try {
  const result = await generateText({
    model: openrouter.chat("anthropic/claude-3-5-sonnet"),
    output: Output.object({ schema: mySchema }),
    prompt: "...",
  })
  return result.object
} catch (error) {
  if (NoObjectGeneratedError.isInstance(error)) {
    console.error("Model returned invalid JSON or wrong schema")
    console.error("Raw text:", error.text)     // what the model actually returned
    console.error("Cause:", error.cause)
    // Retry with a more explicit prompt, or fall back to unstructured
    return null
  }
  throw error
}
```

---

## 6. AI SDK UI Hooks

### Why a Backend Is Required

`useChat`, `useCompletion`, and `useObject` are React hooks that make `fetch` calls to a backend route you control. They speak the Vercel AI stream protocol (newline-delimited JSON), not raw SSE. Without a backend, they cannot work.

| Hook | Backend route returns | Use case |
|---|---|---|
| `useChat` | `toUIMessageStreamResponse()` | Conversational chat |
| `useCompletion` | `toUIMessageStreamResponse()` | Single-turn text completion |
| `useObject` | `Output.object()` stream | Streaming structured objects |

> **Chrome Extension note:** For the side-panel-only extension in this project, use the native `fetch` + SSE approach from `docs/03-ai-sdk-openrouter-setup.md`. The hooks below apply only when you add a Next.js or Hono backend.

### `useChat` — Client Component

```tsx
// components/Chat.tsx (client component — runs in browser)
"use client"
import { useChat } from "ai/react"

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: "/api/chat",          // your backend route
    initialMessages: [],
    onFinish: (message) => {
      console.log("Final message:", message)
    },
    onError: (err) => {
      console.error("Chat error:", err)
    },
  })

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id}>
          <strong>{m.role}:</strong> {m.content}
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} disabled={isLoading} />
        <button type="submit" disabled={isLoading}>Send</button>
      </form>
      {error && <p>Error: {error.message}</p>}
    </div>
  )
}
```

### `useObject` — Streaming Structured Data

```tsx
"use client"
import { experimental_useObject as useObject } from "ai/react"
import { z } from "zod"

const ArticleSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  tags: z.array(z.string()),
})

export function ArticleGenerator() {
  const { object, submit, isLoading } = useObject({
    api: "/api/generate-article",
    schema: ArticleSchema,
  })

  return (
    <div>
      <button onClick={() => submit({ topic: "AI news" })} disabled={isLoading}>
        Generate
      </button>
      {object?.headline && <h1>{object.headline}</h1>}
      {object?.summary && <p>{object.summary}</p>}
    </div>
  )
}
```

### Next.js App Router Backend Route

```ts
// app/api/chat/route.ts  — SERVER-ONLY
import { streamText, convertToModelMessages } from "ai"
import { openrouter } from "@/lib/ai"

export const runtime = "edge"  // optional — works on both Node.js and Edge

export async function POST(req: Request) {
  const { messages } = await req.json()

  // convertToModelMessages converts UIMessage[] → ModelMessage[]
  const modelMessages = convertToModelMessages(messages)

  const stream = streamText({
    model: openrouter.chat("anthropic/claude-3-5-sonnet"),
    system: "You are a helpful assistant.",
    messages: modelMessages,
  })

  return stream.toUIMessageStreamResponse()
}
```

### Hono Backend Route

```ts
// src/routes/chat.ts  — SERVER-ONLY
import { Hono } from "hono"
import { streamText, convertToModelMessages } from "ai"
import { openrouter } from "../lib/ai"

const chat = new Hono()

chat.post("/", async (c) => {
  const { messages } = await c.req.json<{ messages: UIMessage[] }>()

  const modelMessages = convertToModelMessages(messages)

  const stream = streamText({
    model: openrouter.chat("anthropic/claude-3-5-sonnet"),
    messages: modelMessages,
    maxTokens: 2048,
  })

  return stream.toUIMessageStreamResponse()
})

export default chat
```

### `UIMessage` vs `ModelMessage` — Type Bridge

```ts
import { convertToModelMessages, type UIMessage, type ModelMessage } from "ai"

// UIMessage — what useChat/useObject work with (has id, createdAt, etc.)
const uiMessages: UIMessage[] = [
  { id: "1", role: "user", content: "Hello", createdAt: new Date() },
]

// ModelMessage — what generateText/streamText accept (clean role/content pairs)
const modelMessages: ModelMessage[] = convertToModelMessages(uiMessages)
// → [{ role: "user", content: "Hello" }]
```

---

## 7. Streaming Deep Dive

### `fullStream` Event Types

| Event type | Properties | When |
|---|---|---|
| `text-delta` | `textDelta: string` | Each text token arrives |
| `reasoning` | `reasoningDelta: string` | Extended thinking token (Claude 3.7+) |
| `tool-call` | `toolCallId, toolName, args` | Model decides to call a tool |
| `tool-call-delta` | `toolCallId, argsTextDelta` | Streaming tool arguments |
| `tool-result` | `toolCallId, toolName, result` | Tool execute() returns |
| `step-start` | `stepNumber` | New agentic step begins |
| `step-finish` | `stepNumber, finishReason, usage` | Step completes |
| `finish` | `finishReason, usage, totalUsage` | Entire stream completes |
| `error` | `error: Error` | Unrecoverable error |

### Full Stream Event Consumption

```ts
import { streamText } from "ai"

const stream = streamText({
  model: openrouter.chat("anthropic/claude-3-5-sonnet"),
  tools: { searchWeb },
  messages,
})

for await (const chunk of stream.fullStream) {
  switch (chunk.type) {
    case "text-delta":
      process.stdout.write(chunk.textDelta)
      break

    case "tool-call":
      console.log(`\n[Tool call] ${chunk.toolName}(${JSON.stringify(chunk.args)})`)
      break

    case "tool-result":
      console.log(`[Tool result] ${chunk.toolName}: ${JSON.stringify(chunk.result)}`)
      break

    case "step-finish":
      console.log(`\n[Step ${chunk.stepNumber}] ${chunk.finishReason} | tokens: ${chunk.usage.totalTokens}`)
      break

    case "finish":
      console.log(`\n[Done] reason=${chunk.finishReason} | total tokens=${chunk.totalUsage.totalTokens}`)
      break

    case "error":
      console.error("[Stream error]", chunk.error)
      break
  }
}
```

### SSE Response — Manual Construction

```ts
// When you need raw SSE (not the Vercel AI protocol)
import { streamText } from "ai"

export async function POST(req: Request) {
  const { prompt } = await req.json()

  const stream = streamText({ model: openrouter.chat("google/gemini-2.0-flash-exp"), prompt })

  const encoder = new TextEncoder()

  const sseStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream.fullStream) {
        if (chunk.type === "text-delta") {
          const data = `data: ${JSON.stringify({ text: chunk.textDelta })}\n\n`
          controller.enqueue(encoder.encode(data))
        }
        if (chunk.type === "finish") {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          controller.close()
        }
      }
    },
  })

  return new Response(sseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
```

### Browser-Side SSE Consumption

```ts
// Consuming a raw SSE stream from a browser (no AI SDK on client)
async function streamCompletion(prompt: string, onToken: (text: string) => void) {
  const res = await fetch("/api/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  })

  if (!res.body) throw new Error("No response body")

  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const lines = decoder.decode(value).split("\n")
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      const data = line.slice(6).trim()
      if (data === "[DONE]") return
      try {
        const { text } = JSON.parse(data)
        onToken(text)
      } catch {
        // Incomplete JSON chunk — ignore
      }
    }
  }
}
```

---

## 8. Multi-modal (Vision)

### Image Message Formats

```ts
import { generateText } from "ai"

// Format 1: URL
const result = await generateText({
  model: openrouter.chat("anthropic/claude-3-5-sonnet"),
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Describe this image." },
        { type: "image", image: new URL("https://example.com/screenshot.png") },
      ],
    },
  ],
})

// Format 2: base64 string
const result2 = await generateText({
  model: openrouter.chat("google/gemini-2.0-flash-exp"),
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "What is in this screenshot?" },
        {
          type: "image",
          image: "data:image/png;base64,iVBORw0KGgoAAAANS...",
          mimeType: "image/png",
        },
      ],
    },
  ],
})

// Format 3: Uint8Array (raw bytes)
import { readFile } from "fs/promises"

const imageBytes = await readFile("./screenshot.png")
const result3 = await generateText({
  model: openrouter.chat("anthropic/claude-3-5-sonnet"),
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "What UI elements do you see?" },
        { type: "image", image: imageBytes, mimeType: "image/png" },
      ],
    },
  ],
})
```

### OpenRouter Vision Models

| Model ID | Vision | Tools | Context | Notes |
|---|---|---|---|---|
| `anthropic/claude-3-5-sonnet` | Yes | Yes | 200K | Best for UI understanding |
| `anthropic/claude-3-5-haiku` | Yes | Yes | 200K | Fast + cheap |
| `google/gemini-2.0-flash-exp` | Yes | Yes | 1M | Long context, fast |
| `google/gemini-1.5-pro` | Yes | Yes | 2M | Longest context |
| `openai/gpt-4o` | Yes | Yes | 128K | Strong general vision |
| `openai/gpt-4o-mini` | Yes | Yes | 128K | Budget option |
| `meta-llama/llama-3.2-90b-vision-instruct` | Yes | No | 128K | Open weights |

### Screenshot to Base64 (Node.js)

```ts
import { readFile } from "fs/promises"
import { createCanvas, loadImage } from "canvas"  // bun add canvas

async function screenshotToBase64(path: string): Promise<string> {
  const buffer = await readFile(path)
  return `data:image/png;base64,${buffer.toString("base64")}`
}

// With Playwright (for real browser screenshots)
import { chromium } from "playwright"

async function captureScreenshot(): Promise<string> {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto("https://twitter.com")

  const buffer = await page.screenshot({ type: "png" })
  await browser.close()

  return buffer.toString("base64")
}
```

---

## 9. Computer-Use / Browser Agent Patterns

### 6 Browser Action Tools with Zod Schemas

```ts
import { tool } from "ai"
import { z } from "zod"

// Note: all 6 tools omit execute — the agent loop calls them manually
// (browser operations cannot run server-side)

const clickTool = tool({
  description: "Click an element on the page by CSS selector or coordinate",
  inputSchema: z.object({
    selector: z.string().optional().describe("CSS selector (preferred)"),
    x: z.number().optional().describe("X coordinate (fallback)"),
    y: z.number().optional().describe("Y coordinate (fallback)"),
  }),
})

const typeTool = tool({
  description: "Type text into a focused input element",
  inputSchema: z.object({
    text: z.string().describe("Text to type"),
    clearFirst: z.boolean().default(false).describe("Clear existing value before typing"),
  }),
})

const scrollTool = tool({
  description: "Scroll the page or a specific element",
  inputSchema: z.object({
    direction: z.enum(["up", "down", "left", "right"]),
    amount: z.number().describe("Scroll amount in pixels"),
    selector: z.string().optional().describe("Element to scroll (default: window)"),
  }),
})

const screenshotTool = tool({
  description: "Take a screenshot of the current page state",
  inputSchema: z.object({
    selector: z.string().optional().describe("Capture only this element (default: full page)"),
  }),
})

const navigateTool = tool({
  description: "Navigate to a URL",
  inputSchema: z.object({
    url: z.string().url().describe("Full URL to navigate to"),
  }),
})

const extractTool = tool({
  description: "Extract structured data from the current page",
  inputSchema: z.object({
    selector: z.string().describe("CSS selector for elements to extract"),
    attribute: z.string().optional().describe("HTML attribute to extract (default: textContent)"),
    multiple: z.boolean().default(false).describe("Extract all matches or just the first"),
  }),
})

export const browserTools = { clickTool, typeTool, scrollTool, screenshotTool, navigateTool, extractTool }
```

### Manual Tool Execution (No `execute`)

```ts
import { generateText, type ToolCall } from "ai"
import { browserTools } from "./tools/browser"

// Dispatcher that routes tool calls to actual browser automation
async function executeBrowserTool(
  toolName: string,
  args: Record<string, unknown>,
  page: Page  // Playwright Page object
): Promise<unknown> {
  switch (toolName) {
    case "clickTool":
      if (args.selector) await page.click(args.selector as string)
      else await page.mouse.click(args.x as number, args.y as number)
      return { success: true }

    case "typeTool":
      if (args.clearFirst) await page.keyboard.press("Control+a")
      await page.keyboard.type(args.text as string)
      return { success: true }

    case "scrollTool":
      await page.evaluate(
        ({ direction, amount, selector }) => {
          const el = selector ? document.querySelector(selector) : window
          if (!el) return
          const isVertical = direction === "up" || direction === "down"
          const delta = direction === "up" || direction === "left" ? -amount : amount
          ;(el as Element | Window).scrollBy(isVertical ? 0 : delta, isVertical ? delta : 0)
        },
        args as { direction: string; amount: number; selector?: string }
      )
      return { success: true }

    case "screenshotTool":
      const buffer = await page.screenshot({ type: "png" })
      return { screenshot: buffer.toString("base64") }

    case "navigateTool":
      await page.goto(args.url as string)
      return { success: true, url: page.url() }

    case "extractTool":
      return await page.evaluate(
        ({ selector, attribute, multiple }) => {
          const els = multiple
            ? Array.from(document.querySelectorAll(selector))
            : [document.querySelector(selector)].filter(Boolean)
          return els.map((el) => (attribute ? el?.getAttribute(attribute) : el?.textContent?.trim()))
        },
        args as { selector: string; attribute?: string; multiple: boolean }
      )

    default:
      throw new Error(`Unknown tool: ${toolName}`)
  }
}
```

### Observe → Think → Act Agent Loop

```ts
import { generateText, type ModelMessage } from "ai"
import { openrouter } from "./lib/ai"
import { browserTools, executeBrowserTool } from "./tools/browser"

async function runBrowserAgent(task: string, page: Page) {
  const messages: ModelMessage[] = [
    {
      role: "system",
      content: `You are a browser automation agent. Complete the task using the available tools.
Always take a screenshot first to observe the current state before acting.
Think step by step. When the task is complete, respond with DONE: <result>.`,
    },
    { role: "user", content: task },
  ]

  const MAX_STEPS = 30

  for (let step = 0; step < MAX_STEPS; step++) {
    // Take a screenshot to observe current state
    const screenshotBuffer = await page.screenshot({ type: "png" })
    const screenshotBase64 = screenshotBuffer.toString("base64")

    // Inject screenshot as image content
    const lastUserMsg = messages[messages.length - 1]
    if (lastUserMsg.role !== "user") {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: "Current page state:" },
          { type: "image", image: screenshotBase64, mimeType: "image/png" },
        ],
      })
    }

    // Ask the model what to do next
    const result = await generateText({
      model: openrouter.chat("anthropic/claude-3-5-sonnet"),
      tools: browserTools,
      toolChoice: "auto",
      messages,
      maxTokens: 1024,
    })

    messages.push({ role: "assistant", content: result.text, toolCalls: result.toolCalls })

    // Check for completion
    if (result.finishReason === "stop" && result.text.includes("DONE:")) {
      return result.text.replace("DONE:", "").trim()
    }

    // Execute tool calls
    if (result.toolCalls.length === 0) continue

    const toolResults = await Promise.all(
      result.toolCalls.map(async (call) => {
        const toolResult = await executeBrowserTool(call.toolName, call.args, page)
        return { toolCallId: call.toolCallId, result: toolResult }
      })
    )

    messages.push({ role: "tool", content: toolResults })
  }

  throw new Error(`Task not completed within ${MAX_STEPS} steps`)
}
```

### Context Window Management

```ts
// Trim old messages to stay within context limits
function trimMessages(messages: ModelMessage[], maxMessages = 20): ModelMessage[] {
  // Always keep system message + last N exchanges
  const systemMsg = messages.find(m => m.role === "system")
  const rest = messages.filter(m => m.role !== "system")

  if (rest.length <= maxMessages) return messages

  // Keep the most recent messages, always keep pairs (tool-call + tool-result)
  const trimmed = rest.slice(-maxMessages)
  return systemMsg ? [systemMsg, ...trimmed] : trimmed
}
```

---

## 10. Providers & Models on OpenRouter

### Model ID Format

```
{provider}/{model-name}:{variant}
```

Examples:
- `anthropic/claude-3-5-sonnet`
- `anthropic/claude-3-5-haiku:beta`
- `google/gemini-2.0-flash-exp`
- `openai/gpt-4o-mini`
- `meta-llama/llama-3.3-70b-instruct`

### Capability Table

| Model | Tools | Vision | JSON mode | Streaming | Context | Cost/1M in |
|---|---|---|---|---|---|---|
| `anthropic/claude-3-5-sonnet` | Yes | Yes | Yes | Yes | 200K | $3.00 |
| `anthropic/claude-3-5-haiku` | Yes | Yes | Yes | Yes | 200K | $0.80 |
| `anthropic/claude-3-7-sonnet` | Yes | Yes | Yes | Yes | 200K | $3.00 |
| `google/gemini-2.0-flash-exp` | Yes | Yes | Yes | Yes | 1M | $0.00* |
| `google/gemini-1.5-pro` | Yes | Yes | Yes | Yes | 2M | $1.25 |
| `openai/gpt-4o` | Yes | Yes | Yes | Yes | 128K | $2.50 |
| `openai/gpt-4o-mini` | Yes | Yes | Yes | Yes | 128K | $0.15 |
| `meta-llama/llama-3.3-70b-instruct` | Yes | No | Yes | Yes | 128K | $0.12 |
| `mistralai/mistral-small-3.1-24b-instruct` | Yes | Yes | Yes | Yes | 128K | $0.10 |

*Free tier during experimental period

### `providerOptions` — OpenRouter-Specific Settings

```ts
const result = await generateText({
  model: openrouter.chat("anthropic/claude-3-5-sonnet"),
  messages,
  providerOptions: {
    openrouter: {
      // Require responses to come from a subset of providers
      providers: {
        order: ["Anthropic", "AWS Bedrock"],
        allow_fallbacks: false,
      },
      // Add user ID for abuse detection
      user: "user_123",
      // Request extended thinking (Claude 3.7+)
      thinking: {
        type: "enabled",
        budget_tokens: 5000,
      },
    },
  },
})
```

### Fallback Routing Syntax

```ts
// Try primary model, fall back to alternatives on overload/error
const result = await generateText({
  model: openrouter.chat("anthropic/claude-3-5-sonnet"),
  providerOptions: {
    openrouter: {
      providers: {
        order: ["Anthropic", "AWS Bedrock", "GCP Vertex"],
        allow_fallbacks: true,
        data_collection: "deny",  // opt-out of training data
      },
    },
  },
  messages,
})
```

---

## 11. Error Handling

### Error Type Reference

```ts
import {
  APICallError,
  NoObjectGeneratedError,
  ToolExecutionError,
  InvalidPromptError,
} from "ai"
```

### `APICallError` — Network / HTTP Errors

```ts
import { generateText, APICallError } from "ai"

try {
  const result = await generateText({ model, messages })
} catch (error) {
  if (APICallError.isInstance(error)) {
    console.error("API call failed:", {
      message: error.message,
      url: error.url,
      statusCode: error.statusCode,    // HTTP status (e.g. 429, 500)
      responseBody: error.responseBody,
      isRetryable: error.isRetryable,  // true for 429/5xx
    })

    if (error.statusCode === 429) {
      // Rate limited — implement exponential backoff
      await delay(error.retryAfterMs ?? 5000)
    }
  }
  throw error
}
```

### `ToolExecutionError` — Tool `execute` Threw

```ts
import { generateText, ToolExecutionError } from "ai"

try {
  const result = await generateText({ model, tools, messages })
} catch (error) {
  if (ToolExecutionError.isInstance(error)) {
    console.error("Tool execution failed:", {
      toolName: error.toolName,
      toolArgs: error.toolArgs,
      cause: error.cause,  // original error from execute()
    })
  }
  throw error
}
```

### `NoObjectGeneratedError` — Structured Output Failures

```ts
import { generateText, Output, NoObjectGeneratedError } from "ai"

try {
  const result = await generateText({
    model,
    output: Output.object({ schema: mySchema }),
    prompt,
  })
  return result.object
} catch (error) {
  if (NoObjectGeneratedError.isInstance(error)) {
    console.error("Object generation failed:", {
      text: error.text,    // raw model output
      cause: error.cause,  // JSON parse error or schema validation error
    })
    // Strategy: retry with a more explicit prompt
    return retryWithExplicitSchema(prompt)
  }
  throw error
}
```

### Retry Pattern with Exponential Backoff

```ts
async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts?: number; baseDelay?: number } = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelay = 1000 } = opts

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      const isLast = attempt === maxAttempts
      const isRetryable = APICallError.isInstance(error) && error.isRetryable

      if (isLast || !isRetryable) throw error

      const delay = baseDelay * 2 ** (attempt - 1)  // 1s, 2s, 4s
      console.warn(`Attempt ${attempt} failed. Retrying in ${delay}ms...`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }

  throw new Error("Unreachable")
}

// Usage
const result = await withRetry(() =>
  generateText({ model: openrouter.chat("anthropic/claude-3-5-sonnet"), messages })
)
```

---

## 12. Token Usage & Metadata

### `usage` Shape

```ts
// Returned from generateText result and stream.response
interface TokenUsage {
  promptTokens: number       // tokens in the input (messages + system prompt)
  completionTokens: number   // tokens in the model's response
  totalTokens: number        // promptTokens + completionTokens
}

// totalUsage — only on multi-step calls (sum across all steps)
interface TotalUsage extends TokenUsage {
  // same shape, but summed across all agentic steps
}
```

### Accessing Usage

```ts
// generateText — direct
const result = await generateText({ model, messages })
console.log(result.usage)
// → { promptTokens: 245, completionTokens: 87, totalTokens: 332 }

// Per-step usage in multi-step agents
for (const step of result.steps) {
  console.log(`Step ${step.stepNumber}: ${step.usage.totalTokens} tokens`)
}
console.log("Total across all steps:", result.totalUsage)

// streamText — from onFinish callback
const stream = streamText({
  model,
  messages,
  onFinish: ({ usage, totalUsage }) => {
    console.log("Usage:", usage)
    console.log("Total usage:", totalUsage)
  },
})
```

### `onFinish` Logging Pattern

```ts
const stream = streamText({
  model: openrouter.chat("anthropic/claude-3-5-sonnet"),
  messages,

  onFinish: async ({ text, finishReason, usage, totalUsage, steps }) => {
    // Structured logging
    const logEntry = {
      timestamp: new Date().toISOString(),
      model: "anthropic/claude-3-5-sonnet",
      finishReason,
      usage: {
        prompt: usage.promptTokens,
        completion: usage.completionTokens,
        total: usage.totalTokens,
      },
      steps: steps.length,
      textLength: text.length,
    }

    console.log(JSON.stringify(logEntry))

    // Persist to database
    await db.usage.create({ data: logEntry })
  },
})
```

### Cost Estimation

```ts
// OpenRouter pricing (as of early 2025 — check openrouter.ai/models for current rates)
const COST_PER_1M_TOKENS: Record<string, { input: number; output: number }> = {
  "anthropic/claude-3-5-sonnet": { input: 3.0,  output: 15.0  },
  "anthropic/claude-3-5-haiku":  { input: 0.8,  output: 4.0   },
  "openai/gpt-4o":               { input: 2.5,  output: 10.0  },
  "openai/gpt-4o-mini":          { input: 0.15, output: 0.6   },
  "google/gemini-1.5-pro":       { input: 1.25, output: 5.0   },
}

function estimateCost(
  modelId: string,
  usage: { promptTokens: number; completionTokens: number }
): number {
  const pricing = COST_PER_1M_TOKENS[modelId]
  if (!pricing) return 0

  return (
    (usage.promptTokens / 1_000_000) * pricing.input +
    (usage.completionTokens / 1_000_000) * pricing.output
  )
}

// Usage
const result = await generateText({ model, messages })
const costUsd = estimateCost("anthropic/claude-3-5-sonnet", result.usage)
console.log(`Cost: $${costUsd.toFixed(6)}`)
```

### `totalUsage` in Agent Runs

```ts
const agent = new ToolLoopAgent({
  model: openrouter.chat("anthropic/claude-3-5-sonnet"),
  tools,
  stopWhen: stepCountIs(20),
})

const result = await agent.run({ messages })

// totalUsage sums tokens across ALL steps
const totalCost = estimateCost("anthropic/claude-3-5-sonnet", result.totalUsage)
console.log(`Agent total: ${result.totalUsage.totalTokens} tokens, $${totalCost.toFixed(4)}`)
```

---

## Decision Log

| Decision | Rejected alternative | Reason |
|---|---|---|
| `generateText` + `output` over `generateObject` | `generateObject` (deprecated) | v6 consolidates all output modes into `generateText`/`streamText` |
| `inputSchema` over `parameters` | `parameters` (v5 name) | Renamed in v6 for clarity — `parameters` causes TypeScript errors in v6 |
| `stopWhen: stepCountIs(N)` over `maxSteps: N` | `maxSteps` (v5) | `maxSteps` removed in v6; `stopWhen` is more composable |
| `ToolLoopAgent` for agents | Manual while-loop | Less boilerplate; handles step management, `prepareStep`, `totalUsage` aggregation |
| `convertToModelMessages()` bridge | Direct `UIMessage` → `generateText` | `UIMessage` has extra fields (id, createdAt) incompatible with model message format |
| `toUIMessageStreamResponse()` | `toAIStreamResponse()` (deprecated) | Old helper removed in v6; new name matches the `UIMessage` type rename |
| `@openrouter/ai-sdk-provider` | `@ai-sdk/openai` + baseURL | Native provider has better type support and OpenRouter-specific `providerOptions` |

---

*Last updated: 2026-03-21. AI SDK v6. OpenRouter provider `@openrouter/ai-sdk-provider` latest.*
