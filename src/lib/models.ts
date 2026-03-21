export interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
}

export const OPENROUTER_MODELS: OpenRouterModel[] = [
  {
    id: "google/gemini-3.1-flash-lite-preview",
    name: "Gemini 3.1 Flash Lite",
    description: "Latest Google, fast & cheap",
  },
  {
    id: "minimax/minimax-m2.7",
    name: "MiniMax M2.7",
    description: "MiniMax latest",
  },
  {
    id: "minimax/minimax-m2.5",
    name: "MiniMax M2.5",
    description: "MiniMax efficient",
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    name: "Nemotron 3 Super 120B",
    description: "NVIDIA, free tier",
  },
  {
    id: "qwen/qwen3-coder-next",
    name: "Qwen3 Coder Next",
    description: "Qwen coding model",
  },
  {
    id: "openai/gpt-5.4-nano",
    name: "GPT-5.4 Nano",
    description: "OpenAI latest nano",
  },
];
