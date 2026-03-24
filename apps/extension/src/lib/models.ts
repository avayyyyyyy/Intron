export interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  vision: boolean;
}

export const OPENROUTER_MODELS: OpenRouterModel[] = [
  // ── Frontier (best for complex agentic tasks) ──
  {
    id: "anthropic/claude-4.6-sonnet",
    name: "Claude 4.6 Sonnet",
    description: "Anthropic frontier, coding + agents",
    vision: true,
  },
  {
    id: "anthropic/claude-4.6-opus",
    name: "Claude 4.6 Opus",
    description: "Anthropic strongest, long workflows",
    vision: true,
  },
  {
    id: "openai/gpt-5.2",
    name: "GPT-5.2",
    description: "OpenAI frontier, 1M context",
    vision: true,
  },
  {
    id: "google/gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    description: "Google frontier, strong reasoning",
    vision: true,
  },
  {
    id: "deepseek/deepseek-v3.2",
    name: "DeepSeek V3.2",
    description: "Frontier-class at 1/100th the cost",
    vision: false,
  },

  // ── Fast & efficient (best for quick tasks) ──
  {
    id: "google/gemini-3-flash-preview",
    name: "Gemini 3 Flash",
    description: "Google latest flash, 1M context",
    vision: true,
  },
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    description: "Google fast, tool calling",
    vision: true,
  },
  {
    id: "google/gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    description: "Google cheapest, fast",
    vision: true,
  },
  {
    id: "openai/gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    description: "OpenAI fast, tool calling",
    vision: true,
  },
  {
    id: "openai/gpt-5.4-nano",
    name: "GPT-5.4 Nano",
    description: "OpenAI smallest, very fast",
    vision: true,
  },
  {
    id: "moonshotai/kimi-k2.5",
    name: "Kimi K2.5",
    description: "Moonshot, visual coding + agents",
    vision: true,
  },
  {
    id: "x-ai/grok-code-fast-1",
    name: "Grok Code Fast",
    description: "xAI, optimized for coding",
    vision: false,
  },
  {
    id: "x-ai/grok-4.1-fast",
    name: "Grok 4.1 Fast",
    description: "xAI, tool calling",
    vision: false,
  },

  // ── Agentic specialists ──
  {
    id: "xiaomi/mimo-v2-pro",
    name: "MiMo-V2 Pro",
    description: "Xiaomi, built for agents, 1M context",
    vision: false,
  },
  {
    id: "xiaomi/mimo-v2-flash",
    name: "MiMo-V2 Flash",
    description: "Xiaomi agent model, fast",
    vision: false,
  },
  {
    id: "minimax/minimax-m2.5",
    name: "MiniMax M2.5",
    description: "MiniMax, good for agents",
    vision: false,
  },

  // ── Free tier ──
  {
    id: "qwen/qwen3-coder-480b:free",
    name: "Qwen3 Coder 480B",
    description: "Strongest free coding model",
    vision: false,
  },
  {
    id: "deepseek/deepseek-r1:free",
    name: "DeepSeek R1",
    description: "Free, strong reasoning",
    vision: false,
  },
  {
    id: "openai/gpt-oss-120b",
    name: "GPT OSS 120B",
    description: "OpenAI open-source, free",
    vision: false,
  },
];

export function getModelCapabilities(modelId: string): { vision: boolean } {
  const model = OPENROUTER_MODELS.find((m) => m.id === modelId);
  return { vision: model?.vision ?? false };
}

export function getModelName(modelId: string): string {
  return OPENROUTER_MODELS.find((m) => m.id === modelId)?.name ?? modelId;
}
