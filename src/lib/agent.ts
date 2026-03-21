import { ToolLoopAgent, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { getToolsForModel } from "./tools";
import { getModelCapabilities } from "./models";

const SYSTEM_PROMPT =
  "You are Pavo, a helpful AI assistant in a Chrome extension. Provide clear, concise responses. You have access to tools — use them when relevant.";

export function createAgent(apiKey: string, model: string) {
  const openrouter = createOpenRouter({ apiKey });
  const { vision } = getModelCapabilities(model);
  const tools = getToolsForModel(vision);

  return new ToolLoopAgent({
    model: openrouter.chat(model),
    instructions: SYSTEM_PROMPT,
    tools,
    stopWhen: stepCountIs(3),
  });
}
