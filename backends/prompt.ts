// backends/prompt.ts — system prompt assembly (FR-PROMPT-01, FR-PROMPT-02).
// Deterministic composition from the AB's own files. Missing files skip
// their section instead of failing: a half-personalized AB must still boot.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { dueDeferredItems, parseDeferredItems, toIsoDay, type ParsedDeferredItem } from "./deferred";

export interface AssembledPrompt {
  prompt: string;
  /** Due/overdue items included in the prompt (FR-DEFERRED-01 surfaces them). */
  dueItems: ParsedDeferredItem[];
}

function readIfExists(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

export function assembleSystemPrompt(abDirectory: string, now: Date = new Date()): AssembledPrompt {
  const agents = readIfExists(join(abDirectory, "AGENTS.md"));
  const soul = readIfExists(join(abDirectory, "agent_brain", "identity", "SOUL.md"));
  const user = readIfExists(join(abDirectory, "agent_brain", "identity", "USER.md"));
  const deferredRaw = readIfExists(join(abDirectory, "agent_brain", "deferred.md"));

  const dueItems = deferredRaw
    ? dueDeferredItems(parseDeferredItems(deferredRaw), toIsoDay(now))
    : [];

  const sections: string[] = [];

  if (agents) sections.push(agents.trim());
  if (soul) sections.push(`# Your character\n\n${soul.trim()}`);
  if (user) sections.push(`# About your user\n\n${user.trim()}`);

  sections.push(`# Current date and time\n\n${now.toISOString()} (local: ${now.toString()})`);

  if (dueItems.length > 0) {
    const lines = dueItems.map(
      (item) => `- [${item.type}] due ${item.dueDate} (${item.source}): ${item.text}`,
    );
    sections.push(
      `# Pending items to surface\n\n` +
        `These deferred items are due or overdue. Bring them up proactively ` +
        `at the start of the conversation:\n\n${lines.join("\n")}`,
    );
  }

  return { prompt: sections.join("\n\n---\n\n"), dueItems };
}
