import { tool } from "ai";
import { z } from "zod";

export const agentTools = {
  getTime: tool({
    description:
      "Get the current date and time. Use this when the user asks what time or date it is.",
    inputSchema: z.object({}),
    execute: async () => ({
      currentTime: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      formatted: new Date().toLocaleString(),
    }),
  }),
};

export type AgentTools = typeof agentTools;
