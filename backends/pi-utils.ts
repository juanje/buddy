// backends/pi-utils.ts — Shared helpers for Pi event processing.

import type { AgentEvent, AssistantMessageEventLike } from "../shared/api";

export function collectAssistantText(events: AgentEvent[]): string {
  let text = "";
  for (const event of events) {
    if (event.type !== "message_update") continue;
    const sub = event.assistantMessageEvent as AssistantMessageEventLike | undefined;
    if (sub?.type === "text_delta" && typeof sub.delta === "string") {
      text += sub.delta;
    }
  }
  return text.trim();
}
