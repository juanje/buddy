// backends/warm-handoff.ts — first-conversation greeting after setup (FR-SETUP-09).
// Injects a hidden system-framed user message and forwards only assistant
// events so the greeting streams into the chat without showing the prompt.

import type { AgentEvent, FrontendAPI } from "../shared/api";
import type { PiSessionLike } from "./worker-core";

export interface WarmHandoffData {
  name: string;
  about?: string;
}

export function buildWarmHandoffPrompt(data: WarmHandoffData): string {
  const about = data.about?.trim() || "(nothing shared yet)";
  return (
    `[System: the user just completed setup. Their name is "${data.name}". ` +
    `They said about themselves: "${about}". ` +
    `Welcome them by name, briefly explain what you can do, and suggest they tell you ` +
    `something — a task, an idea, or anything on their mind. Be warm but concise.]`
  );
}

function isUserMessageEvent(event: AgentEvent): boolean {
  if (event.type !== "message_start" && event.type !== "message_end") return false;
  const message = event.message as { role?: string } | undefined;
  return message?.role === "user";
}

/** Run the warm handoff turn; assistant events reach the frontend, user prompt does not. */
export async function runWarmHandoff(
  session: PiSessionLike,
  frontend: FrontendAPI,
  data: WarmHandoffData,
): Promise<void> {
  const forward = (event: AgentEvent) => {
    if (isUserMessageEvent(event)) return;
    frontend.onAgentEvent(event);
  };
  const unsub = session.subscribe(forward);
  try {
    await session.prompt(buildWarmHandoffPrompt(data));
  } finally {
    unsub();
  }
}
