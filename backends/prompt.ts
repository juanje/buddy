// backends/prompt.ts — system prompt and session context assembly (FR-PROMPT-01/02).
// Deterministic composition from the buddy's own files. Missing files skip
// their section instead of failing: a half-personalized buddy instance must still boot.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { dueDeferredItems, parseDeferredItems, type ParsedDeferredItem } from "./deferred";
import { toIsoDay } from "../shared/dates";
import { globalConfigDir } from "./global-config";
import { getEmbeddedAssets } from "./embedded-assets";
import { defaultTemplatesDir } from "./create-buddy";
import { dailyLogPath, deferredPath, logsDirPath, logsIndexPath, soulPath, userProfilePath } from "./brain-paths";
import { BRAIN } from "../shared/brain-paths";

function formatPlainDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatPlainTime(d: Date): string {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export interface AssembledPrompt {
  prompt: string;
}

export interface SessionContext {
  /** Wrapped hidden user message; always contains at least the current date. */
  message: string;
  dueItems: ParsedDeferredItem[];
  personalizationPending: boolean;
}

/**
 * A profile is still a placeholder while the Name field has no value
 * (FR-SETUP-07). The wizard copies the template verbatim; the agent fills
 * the name during the first conversation, which ends the interview mode.
 */
/** Collapse whitespace so deployment differences do not read as personalization. */
function normalizeProfile(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").trim();
}

/**
 * True when the profile has not been personalized yet (FR-PROMPT-05).
 *
 * **Compared against the shipped template, deliberately.** The previous
 * implementation searched for a literal `**Name:**` line and reported
 * "placeholder" when it was absent. A profile that had grown to say
 * `- **Full name:** …` therefore looked empty on *every* session, and Buddy
 * injected a block opening "This is your first conversation together" which
 * instructs the model to rewrite USER.md completely. Observed on an instance
 * with a 200-line profile: the assistant asked the user to introduce
 * themselves, and earlier runs had rewritten the profile because they were
 * told to.
 *
 * The template is the one definition that does not depend on a convention the
 * agent is free to change — and it does change it, because the profile is
 * meant to grow, in whatever language and shape the conversation produces.
 *
 * With no template to compare against, a non-empty profile counts as
 * personalized. That direction is the safe one: a missed interview costs one
 * unasked question, while a false interview tells a user who has been using
 * Buddy for months that it does not know them, and orders their profile
 * overwritten.
 */
export function isUserProfilePlaceholder(
  userMd: string | undefined,
  templateMd: string | undefined = readUserProfileTemplate(),
): boolean {
  if (userMd === undefined) return true; // no profile at all: fresh buddy instance
  const profile = normalizeProfile(userMd);
  if (profile === "") return true;
  if (templateMd === undefined) return false;
  return profile === normalizeProfile(templateMd);
}

const USER_TEMPLATE_PATH = BRAIN.user;

/** The shipped USER.md template: embedded in the sidecar, on disk in dev. */
function readUserProfileTemplate(): string | undefined {
  const embedded = getEmbeddedAssets();
  if (embedded) return embedded.templates[USER_TEMPLATE_PATH];
  return readIfExists(join(defaultTemplatesDir(), USER_TEMPLATE_PATH));
}


function readIfExists(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

/**
 * Lightweight system prompt for background maintenance sessions (consolidation,
 * reflect). Excludes AGENTS.md (chat-oriented rules conflict with autonomous
 * maintenance behavior) and session-start injections (deferred items, last log).
 * Keeps SOUL.md + USER.md for personality and user context.
 */
export function assembleMaintenancePrompt(rootDir: string, now: Date = new Date()): string {
  const soul = readIfExists(soulPath(rootDir));
  const user = readIfExists(userProfilePath(rootDir));

  const sections: string[] = [];
  if (soul) sections.push(`# Your character\n\n${soul.trim()}`);
  if (user) sections.push(`# About your user\n\n${user.trim()}`);
  sections.push(`# Current date and time\n\n${formatPlainDate(now)}, ${formatPlainTime(now)}`);

  return sections.join("\n\n---\n\n");
}

/** Identity and rules only — passed to Pi as systemPromptOverride (FR-PROMPT-01). */
export function assembleSystemPrompt(rootDir: string, now: Date = new Date()): AssembledPrompt {
  const agentsBase = readIfExists(join(globalConfigDir(), "prompts", "agents-base.md"));
  const instanceRules =
    readIfExists(join(rootDir, "AGENTS.md")) ??
    readIfExists(join(rootDir, "CLAUDE.md"));
  const soul = readIfExists(soulPath(rootDir));
  const user = readIfExists(userProfilePath(rootDir));

  const sections: string[] = [];

  if (agentsBase) sections.push(agentsBase.trim());
  if (instanceRules) sections.push(instanceRules.trim());
  if (soul) sections.push(`# Your character\n\n${soul.trim()}`);
  if (user) sections.push(`# About your user\n\n${user.trim()}`);

  sections.push(`# Current date and time\n\n${formatPlainDate(now)}, ${formatPlainTime(now)}`);

  return { prompt: sections.join("\n\n---\n\n") };
}

function buildPersonalizationSection(): string {
  return (
    `# First conversation: initial setup\n\n` +
    `Your user profile (agent_brain/identity/USER.md) is still a placeholder. ` +
    `This is your first conversation together.\n\n` +
    `## Why this matters\n\n` +
    `The difference between you and a generic chatbot is that you remember and ` +
    `adapt. But to be useful from the start, you need a minimum about your user. ` +
    `Take 2 minutes to learn the basics — after this, every conversation will be ` +
    `better because of it.\n\n` +
    `## What to do\n\n` +
    `1. Greet them warmly and briefly explain why you're asking (you'll be more ` +
    `useful if you know a few things about them).\n` +
    `2. Ask these questions naturally (not as a numbered list to the user, but ` +
    `cover them all in 1-2 messages):\n` +
    `   - Their name and how they want to be addressed\n` +
    `   - What language they prefer for conversation\n` +
    `   - What they want to use you for (personal tasks, ideas, journal, work, a mix)\n` +
    `   - How they like you to communicate (direct/detailed, formal/casual)\n` +
    `3. Once you have answers, **rewrite** USER.md completely — replace ALL ` +
    `placeholder text with real content. Do not leave template instructions ` +
    `mixed with data. Sections without answers should have a brief placeholder ` +
    `like "(to be discovered)" rather than the original template prose.\n` +
    `4. Confirm what you captured and tell them you're ready.\n\n` +
    `After this setup, switch to normal operation. If they skipped questions, ` +
    `that's fine — fill gaps naturally over time. But always do step 3 (clean ` +
    `rewrite) even with partial answers.`
  );
}

function wrapSessionContext(body: string): string {
  return (
    `[System: session-start context — not visible to the user. ` +
    `Use this to continue where you left off. Surface due deferred items proactively ` +
    `in your first reply if any; otherwise greet briefly or wait for the user.]\n\n` +
    body
  );
}

/** Episodic session context — hidden first user message (FR-PROMPT-02). */
export function assembleSessionContext(rootDir: string, now: Date = new Date()): SessionContext {
  const user = readIfExists(userProfilePath(rootDir));
  const deferredRaw = readIfExists(deferredPath(rootDir));

  const dueItems = deferredRaw
    ? dueDeferredItems(parseDeferredItems(deferredRaw), toIsoDay(now))
    : [];

  const personalizationPending = isUserProfilePlaceholder(user);
  const sections: string[] = [];

  sections.push(`# Today\n\n${formatPlainDate(now)}`);

  const logsIndex = readIfExists(logsIndexPath(rootDir));
  if (logsIndex) {
    sections.push(`# Sessions index\n\n${logsIndex.trim()}`);
  }

  const lastLog = findLastLog(rootDir, logsIndex);
  if (lastLog) {
    sections.push(`# Last session log\n\n${lastLog.trim()}`);
  }

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

  if (personalizationPending) {
    sections.push(buildPersonalizationSection());
  }

  const body = sections.join("\n\n---\n\n");
  return {
    message: body ? wrapSessionContext(body) : "",
    dueItems,
    personalizationPending,
  };
}

/**
 * Find the last dated entry in logs/index.md and read that log.
 * Status is informational only — do not filter by active/maintenance.
 */
function findLastLog(rootDir: string, indexContent: string | undefined): string | undefined {
  if (!indexContent) {
    return findMostRecentLogFile(rootDir);
  }

  let lastDate: string | undefined;
  for (const line of indexContent.split("\n")) {
    const match = /^- (\d{4}-\d{2}-\d{2})/.exec(line);
    if (match) lastDate = match[1];
  }

  if (lastDate) {
    return readIfExists(dailyLogPath(rootDir, lastDate));
  }

  return findMostRecentLogFile(rootDir);
}

/** Fallback when logs/index.md is missing or has no dated entries. */
function findMostRecentLogFile(rootDir: string): string | undefined {
  const logsDir = logsDirPath(rootDir);
  if (!existsSync(logsDir)) return undefined;
  try {
    const files = readdirSync(logsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort()
      .reverse();
    if (files.length === 0) return undefined;
    return readIfExists(join(logsDir, files[0]));
  } catch {
    return undefined;
  }
}
