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
  /** True when the first-run interview instructions were included (FR-SETUP-07). */
  personalizationPending: boolean;
}

/**
 * A profile is still a placeholder while the Name field has no value
 * (FR-SETUP-07). The wizard copies the template verbatim; the agent fills
 * the name during the first conversation, which ends the interview mode.
 */
export function isUserProfilePlaceholder(userMd: string | undefined): boolean {
  if (userMd === undefined) return true; // no profile at all: fresh AB
  const nameLine = userMd.split("\n").find((line) => line.includes("**Name:**"));
  if (!nameLine) return true;
  const value = nameLine.slice(nameLine.indexOf("**Name:**") + "**Name:**".length).trim();
  return value === "";
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

  const personalizationPending = isUserProfilePlaceholder(user);
  if (personalizationPending) {
    sections.push(
      `# First conversation: get to know your user\n\n` +
        `Your user profile (agent_brain/identity/USER.md) is still a placeholder. ` +
        `This is your first conversation together. Introduce yourself briefly and ` +
        `warmly, then get to know your user conversationally — not as a form or ` +
        `questionnaire. Over the conversation, learn at least: their name, their ` +
        `preferred language, their interests, and how they like you to behave ` +
        `(tone, brevity, check-in frequency). Write each answer into ` +
        `agent_brain/identity/USER.md as you learn it, keeping the file's ` +
        `existing structure. Switch to their preferred language as soon as you ` +
        `know it.`,
    );
  }

  return { prompt: sections.join("\n\n---\n\n"), dueItems, personalizationPending };
}
