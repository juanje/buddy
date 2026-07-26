// backends/reflect-prompts.ts — User message templates for reflect child (FR-REFLECT-02/03).
// Session-end reflect uses bundled process-conversation.md + output-only suffix (FR-SKILL-04).

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getEmbeddedAssets } from "./embedded-assets";
import { bundledPromptsDir } from "./deploy-bundled-content";

export const OUTPUT_ONLY_SUFFIX = `\n\n---\nYou have no tools in this context. Produce ONLY the content sections (Decisions, Context, Lessons, etc.) for today's log entry — do NOT include a \`## Session\` header; the worker adds it automatically with correct timestamps. No preamble, no explanation.`;

export const CHECKPOINT_USER_PROMPT = `Briefly encode the recent segment of this session before context compaction:

### Context
What was happening in this segment of the session.

### Notes
Anything worth remembering from this segment.

Be very concise — this is a checkpoint, not a full reflect. Write in English.`;

const PROCESS_CONVERSATION_FILENAME = "process-conversation.md";

/** Load bundled process-conversation prompt (embedded snapshot in prod, disk in dev). */
export function loadProcessConversationPrompt(): string {
  const embedded = getEmbeddedAssets();
  const fromEmbedded = embedded?.prompts[PROCESS_CONVERSATION_FILENAME];
  if (fromEmbedded) return fromEmbedded;

  return readFileSync(join(bundledPromptsDir(), PROCESS_CONVERSATION_FILENAME), "utf8");
}

/** Build the user prompt for reflect child by mode. */
export function buildReflectUserPrompt(mode: string): string {
  if (mode === "checkpoint") return CHECKPOINT_USER_PROMPT;
  return loadProcessConversationPrompt() + OUTPUT_ONLY_SUFFIX;
}
