// backends/orientation-one-liner.ts — fetch agent recap without chat bubbles (FR-ORIENT-03).

import type { AgentEvent } from "../shared/api";
import { collectAssistantText } from "./pi-utils";
import { buildOneLinerPrompt } from "./orientation-prompt";
import type { PiSessionLike } from "./worker-core";

export async function fetchOneLinerFromSession(session: PiSessionLike): Promise<string | null> {
  const events: AgentEvent[] = [];
  const unsub = session.subscribe((event) => events.push(event));
  try {
    await session.prompt(buildOneLinerPrompt());
  } finally {
    unsub();
  }
  const text = collectAssistantText(events).trim();
  return text || null;
}
