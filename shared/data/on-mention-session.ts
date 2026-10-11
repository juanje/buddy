// shared/data/on-mention-session.ts — Session line for on_mention entries (FR-DATA-04).

import type { DataRegistryEntry } from "./registry";

const SECTION_HEADING = "# Active data to record on mention";
const BODY_CHAR_LIMIT = 400;

function firstInstructionLine(instructions: string | undefined): string | undefined {
  if (!instructions?.trim()) return undefined;
  return instructions.trim().split(/\r?\n/)[0]?.trim();
}

function entryFragment(entry: DataRegistryEntry, withInstructions: boolean): string {
  const base = `${entry.name} (${entry.path})`;
  if (!withInstructions) return base;
  const line = firstInstructionLine(entry.instructions);
  return line ? `${base} — ${line}` : base;
}

/** One section string, or undefined when there are no entries. */
export function formatOnMentionSessionSection(entries: DataRegistryEntry[]): string | undefined {
  if (entries.length === 0) return undefined;

  const withInstr = entries.map((e) => entryFragment(e, true)).join("; ");
  let body = withInstr;
  if (body.length > BODY_CHAR_LIMIT) {
    body = entries.map((e) => entryFragment(e, false)).join("; ");
  }
  if (body.length > BODY_CHAR_LIMIT) {
    const parts: string[] = [];
    for (const entry of entries) {
      const frag = entryFragment(entry, false);
      const candidate = parts.length === 0 ? frag : `${parts.join("; ")}; ${frag}`;
      if (candidate.length > BODY_CHAR_LIMIT - 15) break;
      parts.push(frag);
    }
    const notShown = entries.length - parts.length;
    body = notShown > 0 ? `${parts.join("; ")} (+${notShown} more)` : parts.join("; ");
  }

  return `${SECTION_HEADING}\n\n${body}`;
}

export function onMentionEntries(entries: DataRegistryEntry[]): DataRegistryEntry[] {
  return entries.filter((e) => e.mode === "on_mention");
}
