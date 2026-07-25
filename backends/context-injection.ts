// backends/context-injection.ts — hidden session-start context delivery (FR-PROMPT-04).

import type { AgentEvent, FrontendAPI } from "../shared/api";
import type { PiSessionLike } from "./worker-core";

function isUserMessageEvent(event: AgentEvent): boolean {
  if (event.type !== "message_start" && event.type !== "message_end") return false;
  const message = event.message as { role?: string } | undefined;
  return message?.role === "user";
}

/** Send a hidden user message; only assistant events reach the frontend. */
export async function injectHiddenPrompt(
  session: PiSessionLike,
  frontend: FrontendAPI,
  userPrompt: string,
): Promise<void> {
  const forward = (event: AgentEvent) => {
    if (isUserMessageEvent(event)) return;
    frontend.onAgentEvent(event);
  };
  const unsub = session.subscribe(forward);
  try {
    await session.prompt(userPrompt);
  } finally {
    unsub();
  }
}

/** Inject assembled session context before the user's first turn. */
export async function injectSessionContext(
  session: PiSessionLike,
  frontend: FrontendAPI,
  contextMessage: string,
): Promise<void> {
  if (!contextMessage.trim()) return;
  await injectHiddenPrompt(session, frontend, contextMessage);
}
