import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { USER_DIR } from "../shared/brain-paths";
import type { TaskItem } from "../shared/task-types";
import { parseTaskFileContent, writeTasksFile } from "./tasks/task-file";

const PREFERENCES_HEADING = "## Preferences";
const PRINCIPLES_HEADING = "## Principles";

const PREFERENCES_SCAFFOLD = `\n${PREFERENCES_HEADING}

How the user likes to work, communicate, and receive information. Keep current — update when preferences change, don't accumulate history here.
`;

const PRINCIPLES_SCAFFOLD = `\n${PRINCIPLES_HEADING}

Cross-domain patterns that explain multiple preferences or behaviors. Only add principles with strong evidence from several data points.
`;

export const OLD_AGENTS_MD_MARKER = "## Core behavior";
export const AGENTS_MD_BACKUP_REL = ".buddy/migrations/agents-md-pre-split.md";

/** Core rule prefixes — rules starting with these are shipped in agents-base.md. */
export const CORE_RULE_PREFIXES = [
  "**Language:**",
  "Don't read files preemptively",
  "**Memory first.**",
  "**Retention by memory type.**",
  "`USER.md` can be updated",
  "**Write it or don't say it.**",
  "**No unsourced content.**",
  "**Context is not a task.",
  "**Confirm scope before acting",
  "**Logs and memory files are context",
  "**Don't edit system-level structures",
  "**Execute skills silently.**",
] as const;

const INSTANCE_SECTIONS = ["Active context", "Where to find things", "Skills", "Rules"] as const;

const RULES_SCAFFOLD = `## Rules

Instance-specific rules learned from usage patterns. Added by consolidation when observations reach maturity (seen 2+). Core behavioral rules are part of the system prompt — do not duplicate them here.
`;

function hasSection(content: string, heading: string): boolean {
  return new RegExp(`^${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "m").test(content);
}

export function ensureUserMdSections(content: string): string {
  let result = content;
  if (!hasSection(result, PREFERENCES_HEADING)) {
    result = result.trimEnd() + "\n" + PREFERENCES_SCAFFOLD;
  }
  if (!hasSection(result, PRINCIPLES_HEADING)) {
    result = result.trimEnd() + "\n" + PRINCIPLES_SCAFFOLD;
  }
  return result;
}

/**
 * Read USER.md from disk, scaffold missing sections, write back only if changed.
 * No-op when the section already exists.
 */
export function ensureUserMdSectionsOnDisk(rootDir: string): void {
  const userMdPath = join(rootDir, "agent_brain", "identity", "USER.md");
  if (!existsSync(userMdPath)) return;
  const original = readFileSync(userMdPath, "utf8");
  const updated = ensureUserMdSections(original);
  if (updated !== original) {
    writeFileSync(userMdPath, updated);
  }
}

export function isOldAgentsMdFormat(content: string): boolean {
  return content.includes(OLD_AGENTS_MD_MARKER);
}

interface ParsedSection {
  heading: string;
  body: string;
}

export function parseAgentsMdSections(content: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const lines = content.split("\n");
  let current: ParsedSection | null = null;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (current) sections.push(current);
      current = { heading: line.slice(3).trim(), body: "" };
      continue;
    }
    if (current) {
      current.body += (current.body ? "\n" : "") + line;
    }
  }
  if (current) sections.push(current);
  return sections;
}

export function isCoreRule(ruleText: string): boolean {
  const trimmed = ruleText.trim();
  if (!trimmed) return false;
  const withoutNumber = trimmed.replace(/^\d+\.\s*/, "");
  return CORE_RULE_PREFIXES.some((prefix) => withoutNumber.startsWith(prefix));
}

export function extractInstanceRules(rulesBody: string): string[] {
  const trimmed = rulesBody.trim();
  if (!trimmed) return [];

  const scaffoldMarkers = [
    "Instance-specific rules learned",
    "Added by consolidation when observations",
  ];
  if (scaffoldMarkers.some((m) => trimmed.includes(m)) && !/^\d+\.\s/m.test(trimmed)) {
    return [];
  }

  const parts = trimmed.split(/\n(?=\d+\.\s)/);
  return parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !isCoreRule(part));
}

function formatRulesSection(instanceRules: string[]): string {
  if (instanceRules.length === 0) return RULES_SCAFFOLD;
  const numbered = instanceRules.map((rule, index) => {
    const text = rule.replace(/^\d+\.\s*/, "");
    return `${index + 1}. ${text}`;
  });
  return `${RULES_SCAFFOLD}\n\n${numbered.join("\n")}\n`;
}

export function migrateAgentsMdContent(content: string): string {
  if (!isOldAgentsMdFormat(content)) return content;

  const sections = parseAgentsMdSections(content);
  const byHeading = new Map(sections.map((s) => [s.heading, s.body.trim()]));

  const parts: string[] = ["# Buddy", ""];

  for (const heading of INSTANCE_SECTIONS) {
    if (heading === "Rules") continue;
    const body = byHeading.get(heading);
    if (!body) continue;
    parts.push(`## ${heading}`, "", body, "");
  }

  const rulesBody = byHeading.get("Rules") ?? "";
  parts.push(formatRulesSection(extractInstanceRules(rulesBody)).trimEnd(), "");
  return parts.join("\n").trimEnd() + "\n";
}

/**
 * Strip core instructions from AGENTS.md when still in the old format.
 * Backs up the original to `.buddy/migrations/agents-md-pre-split.md`.
 * Returns true when a migration was applied.
 */
export function migrateAgentsMdIfNeeded(rootDir: string): boolean {
  const agentsPath = join(rootDir, "AGENTS.md");
  if (!existsSync(agentsPath)) return false;

  const original = readFileSync(agentsPath, "utf8");
  if (!isOldAgentsMdFormat(original)) return false;

  const migrated = migrateAgentsMdContent(original);
  if (migrated === original) return false;

  const backupPath = join(rootDir, AGENTS_MD_BACKUP_REL);
  mkdirSync(dirname(backupPath), { recursive: true });
  writeFileSync(backupPath, original, "utf8");
  writeFileSync(agentsPath, migrated, "utf8");
  return true;
}

const INBOX_CHECKBOX_RE = /^- \[( |x)\]\s*(.*)$/;

function extractInboxTaskLines(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => INBOX_CHECKBOX_RE.test(line));
}

function applyFirstNextPerArea(items: TaskItem[]): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (item.done) continue;
    const key = item.area ?? "";
    if (seen.has(key)) continue;
    seen.add(key);
    item.next = true;
  }
}

/**
 * Migrate GTD inbox.md to flat tasks.md once (FR-TASK-07).
 * Returns true when migration ran.
 */
const TASKS_NAV_LINE =
  "  - [Tasks](user/tasks.md) — personal action list managed via the `tasks()` tool. Read when the user asks what's pending, what to work on, or when capturing new actions.";

const AGENTS_INBOX_NAV_RE = /^\s*-\s*\[Inbox\]\(user\/inbox\.md\).*$/m;

/**
 * Replace legacy Inbox navigation line in AGENTS.md (FR-TASK-07).
 * Idempotent when already migrated or line absent.
 */
export function migrateAgentsTasksReference(rootDir: string): boolean {
  const agentsPath = join(rootDir, "AGENTS.md");
  if (!existsSync(agentsPath)) return false;

  let content = readFileSync(agentsPath, "utf8");
  let changed = false;

  if (AGENTS_INBOX_NAV_RE.test(content)) {
    content = content.replace(AGENTS_INBOX_NAV_RE, TASKS_NAV_LINE);
    changed = true;
  }

  if (content.includes("inbox.md")) {
    content = content.replace(/`inbox\.md`/g, "`tasks.md`");
    content = content.replace(/\binbox\.md\b/g, "tasks.md");
    changed = true;
  }

  if (!changed) return false;

  writeFileSync(agentsPath, content, "utf8");
  return true;
}

const WORKSPACES_NAV_LINE =
  "  - [Workspaces](user/workspaces/) — areas of focus: ongoing topics or initiatives with no defined end. Read when the user asks about an area they work in continuously.";

const AGENTS_TASKS_NAV_RE = /^(\s*-\s*\[Tasks\]\(user\/tasks\.md\).*)$/m;

/**
 * Insert workspaces nav line in AGENTS.md if absent (FR-TASKM-21).
 * Inserts after the Tasks nav line. Idempotent.
 */
export function migrateAgentsWorkspacesReference(rootDir: string): boolean {
  const agentsPath = join(rootDir, "AGENTS.md");
  if (!existsSync(agentsPath)) return false;

  mkdirSync(join(rootDir, USER_DIR, "workspaces"), { recursive: true });

  const content = readFileSync(agentsPath, "utf8");
  if (content.includes("user/workspaces/")) return false;
  if (!AGENTS_TASKS_NAV_RE.test(content)) return false;

  const updated = content.replace(AGENTS_TASKS_NAV_RE, `$1\n${WORKSPACES_NAV_LINE}`);
  writeFileSync(agentsPath, updated, "utf8");
  return true;
}

export function migrateInboxToTasksIfNeeded(rootDir: string): boolean {
  const inboxPath = join(rootDir, USER_DIR, "inbox.md");
  const tasksPath = join(rootDir, USER_DIR, "tasks.md");
  if (!existsSync(inboxPath) || existsSync(tasksPath)) return false;

  const inboxContent = readFileSync(inboxPath, "utf8");
  const lines = extractInboxTaskLines(inboxContent);
  if (lines.length === 0) {
    writeTasksFile(rootDir, []);
    unlinkSync(inboxPath);
    return true;
  }

  const pseudoFile = ["# Tasks", "", ...lines].join("\n");
  const items = parseTaskFileContent(pseudoFile);
  applyFirstNextPerArea(items);
  writeTasksFile(rootDir, items);
  unlinkSync(inboxPath);
  return true;
}
