// backends/reflect-prompts.ts — User message templates for reflect child (FR-REFLECT-02/03).
// Session-end reflect uses bundled process-conversation.md + output-only suffix (FR-SKILL-04).

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getEmbeddedAssets } from "./embedded-assets";
import { bundledPromptsDir } from "./deploy-bundled-content";

export const OUTPUT_ONLY_SUFFIX = `\n\n---\nYou have no tools in this context. Produce ONLY the content sections for today's log entry — do NOT include a \`## Session\` header; the worker adds it automatically with correct timestamps. Use \`###\` (h3) for section headings (e.g. \`### Context\`, \`### Decisions\`). No preamble, no explanation.\n\nTwo steps of the procedure above assume tools you do not have here:\n- **Step 3 (Verify captures): skip it.** You cannot read the files to check, and guessing whether something landed is worse than not saying.\n- **Step 4 (Detect observations): do not write to \`agent_brain/observations.md\`.** If genuine signals emerged, put them in an \`### Observations\` section and the worker will file them. Omit the section entirely when nothing emerged.\n\nWrite only about the conversation. Never write about this procedure — the instructions above are not something the session taught you.`

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

/**
 * Split an `### Observations` section out of reflect output (FR-REFLECT-08).
 *
 * The reflect fork runs with `noTools: "all"`, so step 4 of
 * `process-conversation.md` — "Write to `agent_brain/observations.md`" — cannot
 * be carried out there. The model's only way to comply is to emit the section
 * as text, which then landed in the daily log where nothing reads it.
 *
 * Rather than delete the step, the division of labour the app uses everywhere
 * else applies: the model judges what is worth observing, the worker files it.
 * The section is removed from the log body on purpose — observations.md and the
 * daily log are both injected into future sessions, and the same text in both
 * is noise.
 */
export function extractObservationsSection(output: string): {
  body: string;
  observations?: string;
} {
  const match = /\n###[ \t]*Observations[ \t]*\n([\s\S]*?)(?=\n###[ \t]|\s*$)/.exec(output);
  if (!match) return { body: output };

  const observations = match[1].trim();
  const body = (output.slice(0, match.index) + output.slice(match.index + match[0].length)).trimEnd();
  // An empty heading is the model acknowledging the step with nothing to say.
  return observations ? { body: `${body}\n`, observations } : { body };
}
