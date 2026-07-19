// backends/pi-maintenance.ts — Short-lived Pi sessions for reflect encoding (FR-REFLECT-02/03).

import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

import type { AgentEvent, AssistantMessageEventLike } from "../shared/api";
import { assembleSystemPrompt } from "./prompt";

function collectAssistantText(events: AgentEvent[]): string {
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

/** Run a one-shot maintenance prompt and return assistant text (no chat UI). */
export async function runMaintenancePrompt(
  abDirectory: string,
  userPrompt: string,
): Promise<string> {
  const { prompt } = assembleSystemPrompt(abDirectory);
  const resourceLoader = new DefaultResourceLoader({
    cwd: abDirectory,
    agentDir: getAgentDir(),
    systemPromptOverride: () => prompt,
  });
  await resourceLoader.reload();

  const { session } = await createAgentSession({
    cwd: abDirectory,
    resourceLoader,
    sessionManager: SessionManager.create(abDirectory),
    excludeTools: ["bash"],
  });

  const events: AgentEvent[] = [];
  const unsub = session.subscribe((event) => events.push(event));
  try {
    await session.prompt(userPrompt);
    return collectAssistantText(events);
  } finally {
    unsub();
    session.dispose();
  }
}

export function buildCatchUpReflectPrompt(skeleton: string): string {
  return (
    "Process this session skeleton into a concise reflect summary with markdown sections: " +
    "Decisions, Lessons, Context, Open threads.\n\n" +
    skeleton
  );
}

export function buildIncrementalReflectPrompt(segment: string): string {
  return (
    "Encode this session segment into a brief reflect snapshot. " +
    "Capture decisions, tasks, and context in markdown sections: Tasks, Context, Notes.\n\n" +
    segment
  );
}
