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

/**
 * Inject session context silently — adds the message to conversation history
 * but suppresses the model's response from reaching the frontend.
 * The context is available when the user sends their first real message.
 * Must be called BEFORE the worker core subscriber is active.
 */
export async function injectSessionContext(
  session: PiSessionLike,
  _frontend: FrontendAPI,
  contextMessage: string,
): Promise<void> {
  if (!contextMessage.trim()) return;
  const unsub = session.subscribe(() => {});
  try {
    await session.prompt(contextMessage);
  } finally {
    unsub();
  }
}
