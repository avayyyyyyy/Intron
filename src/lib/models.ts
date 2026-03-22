export interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  vision: boolean;
}

export const OPENROUTER_MODELS: OpenRouterModel[] = [
  {
    id: "google/gemini-3.1-flash-lite-preview",
    name: "Gemini 3.1 Flash Lite",
    description: "Latest Google, fast & cheap",
    vision: true,
  },
  {
    id: "minimax/minimax-m2.7",
    name: "MiniMax M2.7",
    description: "MiniMax latest",
    vision: false,
  },
  {
    id: "openai/gpt-oss-120b",
    name: "OpenAI GPT OSS 120B",
    description: "OpenAI latest 120B model",
    vision: false,
  },
  {
    id: "minimax/minimax-m2.5",
    name: "MiniMax M2.5",
    description: "MiniMax efficient",
    vision: false,
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    name: "Nemotron 3 Super 120B",
    description: "NVIDIA, free tier",
    vision: false,
  },
  {
    id: "qwen/qwen3-coder-next",
    name: "Qwen3 Coder Next",
    description: "Qwen coding model",
    vision: false,
  },
  {
    id: "openai/gpt-5.4-nano",
    name: "GPT-5.4 Nano",
    description: "OpenAI latest nano",
    vision: true,
  },
];

export function getModelCapabilities(modelId: string): { vision: boolean } {
  const model = OPENROUTER_MODELS.find((m) => m.id === modelId);
  return { vision: model?.vision ?? false };
}
