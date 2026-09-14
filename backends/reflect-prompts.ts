// backends/reflect-prompts.ts — User message templates for reflect child (FR-REFLECT-02/03).
// Session-end reflect uses bundled process-conversation.md + output-only suffix (FR-SKILL-04).

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getEmbeddedAssets } from "./embedded-assets";
import { bundledPromptsDir } from "./deploy-bundled-content";

export const OUTPUT_ONLY_SUFFIX = `\n\n---\nYou have no tools in this context — produce the content sections for today's log entry. Do NOT include a \`## Session\` header; the worker adds it automatically with correct timestamps. Use \`###\` (h3) for section headings (e.g. \`### Context\`, \`### Decisions\`). No preamble, no explanation.\n\nThree steps of the procedure above assume tools you do not have here:\n- **Step 3 (Verify captures): skip it.** You cannot read the files to check, and guessing whether something landed is worse than not saying.\n- **Step 4 (Active context patches): emit a \`### Right now patches\` section** with the complete updated Right now content when session events changed volatile state. The worker replaces the section in AGENTS.md. Omit when nothing volatile changed.\n- **Step 5 (Detect observations): emit an \`### Observations\` section with entries the worker will file.** This is the most valuable part of the reflect — invest effort here. A session that produced decisions or lessons almost certainly has observation-worthy patterns. Omit ONLY when the session was genuinely trivial.\n\nCapture the full reasoning behind decisions, not just conclusions. A log entry that says "Decided X" without explaining why is a failure — future sessions need the reasoning to avoid re-deriving it.\n\nWrite about the conversation. Never write about this procedure — the instructions above are not something the session taught you.`

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
 * The reflect fork runs with `noTools: "all"`, so step 5 of
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
  const { body, extracted } = extractNamedSection(output, "Observations");
  return extracted ? { body, observations: extracted } : { body };
}

/**
 * Split a `### Right now patches` section out of reflect output (FR-REFLECT-11).
 *
 * Same division of labour as observations: the model judges the updated
 * volatile state, the worker replaces `### Right now` in AGENTS.md. The
 * heading is `Right now patches`, not `Right now`, so a log section that
 * happens to use the latter is left in the body.
 */
export function extractRightNowPatches(output: string): {
  body: string;
  rightNowPatches?: string;
} {
  const { body, extracted } = extractNamedSection(output, "Right now patches");
  return extracted ? { body, rightNowPatches: extracted } : { body };
}

function extractNamedSection(output: string, heading: string): {
  body: string;
  extracted?: string;
} {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(
    `(?:^|\\n)###[ \\t]*${escaped}[ \\t]*\\n([\\s\\S]*?)(?=\\n###[ \\t]|\\s*$)`,
  ).exec(output);
  if (!match) return { body: output };

  const extracted = match[1].trim();
  const body = (output.slice(0, match.index) + output.slice(match.index + match[0].length)).trimEnd();
  if (!extracted) return { body };
  return { body: `${body}\n`, extracted };
}
