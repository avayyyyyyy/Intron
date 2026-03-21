import { tool } from "ai";
import { z } from "zod";
import { sendToBackground } from "./messaging";

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

  getScreenshot: tool({
    description:
      "Take a screenshot of the currently visible browser tab. Returns a base64-encoded PNG data URL. Use this when the user asks to see or analyze what's on their screen.",
    inputSchema: z.object({}),
    execute: async () => {
      const { dataUrl } = await sendToBackground("CAPTURE_SCREENSHOT");
      return { imageDataUrl: dataUrl };
    },
  }),

  getPageContent: tool({
    description:
      "Extract the text content of the current browser tab. Returns the page title, URL, main text content, and meta description. Use this when the user asks to summarize, analyze, or read the current page.",
    inputSchema: z.object({}),
    execute: async () => {
      return await sendToBackground("GET_PAGE_CONTENT");
    },
  }),
};

export type AgentTools = typeof agentTools;
export type ToolName = keyof AgentTools;

/** Tool display metadata — co-located with definitions to stay in sync */
export const TOOL_META: Record<ToolName, { label: string; iconName: string }> = {
  getTime: { label: "Current time", iconName: "Clock" },
  getScreenshot: { label: "Screenshot", iconName: "Camera" },
  getPageContent: { label: "Page content", iconName: "Globe" },
};

const { getScreenshot: _, ...toolsWithoutScreenshot } = agentTools;

export function getToolsForModel(vision: boolean) {
  return vision ? agentTools : toolsWithoutScreenshot;
}
