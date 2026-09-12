// backends/consolidation-helpers.ts — Log rotation, reminders, and logs index helpers.

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";

import { addDays } from "../shared/dates";
import { LOG_ROTATION_THRESHOLD } from "../shared/defaults";
import { updateLogsIndexEntry } from "./reflect";
import { dailyLogPath, logsDirPath } from "./brain-paths";

const DATE_MARKER_RE = /\b(\d{4}-\d{2}-\d{2})\b/;
const CREATED_COMMENT_RE = /<!--\s*c:\d{4}-\d{2}-\d{2}\s*-->/;

function lineDateForReminder(line: string): string | undefined {
  const cleaned = line.replace(CREATED_COMMENT_RE, "");
  const match = DATE_MARKER_RE.exec(cleaned);
  return match?.[1];
}
const MARKDOWN_LINK = /\[([^\]]*)\]\(([^)]+)\)/g;

/** Rewrite relative markdown links when a log moves deeper in the tree (FR-CONSOL-26). */
export function rewriteLinksForArchive(
  content: string,
  oldDir: string,
  newDir: string,
): string {
  return content.replace(MARKDOWN_LINK, (full, display: string, target: string) => {
    const trimmed = target.trim();
    if (!trimmed || /^https?:\/\//i.test(trimmed) || trimmed.startsWith("#")) return full;

    const hashIndex = trimmed.indexOf("#");
    const pathPart = hashIndex === -1 ? trimmed : trimmed.slice(0, hashIndex);
    const anchor = hashIndex === -1 ? "" : trimmed.slice(hashIndex);
    if (!pathPart) return full;

    const resolved = resolve(oldDir, pathPart);
    const newRel = relative(newDir, resolved).replace(/\\/g, "/");
    return `[${display}](${newRel}${anchor})`;
  });
}

export interface UpcomingReminder {
  source: "tasks" | "active-context";
  line: string;
}

function listLogFiles(logsDir: string): string[] {
  if (!existsSync(logsDir)) return [];
  return readdirSync(logsDir)
    .filter((f) => f.endsWith(".md") && f !== "index.md" && !f.startsWith("monthly_"))
    .sort();
}

const LAST_UPDATED_RE = /^last_updated:\s*(\S+)/m;

function parseLastUpdated(content: string): string | null {
  const match = content.match(LAST_UPDATED_RE);
  return match?.[1] ?? null;
}

/** Log dates with reflect content newer than the last depth-1 run (FR-CONSOL-27). */
export function findPendingLogs(
  rootDir: string,
  lastDepth1: string | null,
  today: string,
): string[] {
  if (!lastDepth1) return [];

  const logsDir = logsDirPath(rootDir);
  if (!existsSync(logsDir)) return [];

  const pending: string[] = [];
  for (const file of listLogFiles(logsDir)) {
    const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})\.md$/);
    if (!dateMatch) continue;

    const logDate = dateMatch[1];
    if (logDate === today) continue;

    const content = readFileSync(join(logsDir, file), "utf8");
    const lastUpdated = parseLastUpdated(content);
    if (!lastUpdated) continue;
    if (lastUpdated > lastDepth1) pending.push(logDate);
  }

  return pending.sort();
}

export function formatPendingLogsBlock(pendingDates: string[]): string {
  if (pendingDates.length === 0) {
    return "Pending logs: none (today's log is current).";
  }

  const lines = [
    "Pending logs (unconsolidated content since last depth-1):",
    ...pendingDates.map((date) => `- logs/${date}.md`),
  ];
  return lines.join("\n");
}

export function rotateLogs(rootDir: string, targetDate: string): { archived: string[] } {
  const logsDir = logsDirPath(rootDir);
  const files = listLogFiles(logsDir);
  if (files.length <= LOG_ROTATION_THRESHOLD) return { archived: [] };

  const toArchive = files.slice(0, files.length - LOG_ROTATION_THRESHOLD);
  const archived: string[] = [];

  for (const file of toArchive) {
    const dateMatch = file.match(/^(\d{4}-\d{2})/);
    const monthDir = dateMatch ? dateMatch[1] : targetDate.slice(0, 7);
    const archiveDir = join(logsDir, "archive", monthDir);
    mkdirSync(archiveDir, { recursive: true });

    renameSync(join(logsDir, file), join(archiveDir, file));

    const archivedPath = join(archiveDir, file);
    const content = readFileSync(archivedPath, "utf8");
    const rewritten = rewriteLinksForArchive(content, logsDir, archiveDir);
    if (rewritten !== content) writeFileSync(archivedPath, rewritten);

    const indexPath = join(logsDir, "index.md");
    if (existsSync(indexPath)) {
      const index = readFileSync(indexPath, "utf8");
      const updated = index
        .split("\n")
        .filter((line) => !line.includes(file))
        .join("\n");
      writeFileSync(indexPath, updated);
    }

    const archiveIndexPath = join(archiveDir, "index.md");
    const archiveIndexLine = `- ${file}\n`;
    if (existsSync(archiveIndexPath)) {
      appendFileSync(archiveIndexPath, archiveIndexLine);
    } else {
      writeFileSync(
        archiveIndexPath,
        `# Sessions — ${monthDir}\n\nLog files: \`${file}\` (in this directory).\n\n${archiveIndexLine}`,
      );
    }

    archived.push(file);
  }

  return { archived };
}

export function findDatedTaskItems(rootDir: string, targetDate: string): string[] {
  const tasksPath = join(rootDir, "user", "tasks.md");
  if (!existsSync(tasksPath)) return [];

  const tomorrow = addDays(targetDate, 1);
  const content = readFileSync(tasksPath, "utf8");

  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (!line.startsWith("-")) return false;
      const dueDate = lineDateForReminder(line);
      return dueDate === targetDate || dueDate === tomorrow;
    });
}

/** @deprecated Use findDatedTaskItems */
export const findDatedInboxItems = findDatedTaskItems;

function extractActiveContextSection(agentsContent: string): string {
  const match = agentsContent.match(
    /(?:^|\n)###\s+Right now\b([\s\S]*?)(?=\n###\s+Files\b|\n##\s+|\n---\s*$|$)/i,
  );
  return match?.[1]?.trim() ?? "";
}

function findDatedActiveContextItems(rootDir: string, targetDate: string): string[] {
  const agentsPath = join(rootDir, "AGENTS.md");
  if (!existsSync(agentsPath)) return [];

  const tomorrow = addDays(targetDate, 1);
  const section = extractActiveContextSection(readFileSync(agentsPath, "utf8"));

  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("-"))
    .filter((line) => {
      const dueDate = lineDateForReminder(line);
      return dueDate === targetDate || dueDate === tomorrow;
    });
}

export function findUpcomingReminders(rootDir: string, targetDate: string): UpcomingReminder[] {
  const reminders: UpcomingReminder[] = [];

  for (const line of findDatedTaskItems(rootDir, targetDate)) {
    reminders.push({ source: "tasks", line });
  }
  for (const line of findDatedActiveContextItems(rootDir, targetDate)) {
    reminders.push({ source: "active-context", line });
  }

  return reminders;
}

const PENDING_INBOX_FILENAME = "inbox.md.pending-migration";

/** FR-CONSOL-31: signal pending inbox migration in consolidation prompt header. */
export function formatPendingInboxBlock(rootDir: string): string | undefined {
  const pendingPath = join(rootDir, "user", PENDING_INBOX_FILENAME);
  if (!existsSync(pendingPath)) return undefined;

  const content = readFileSync(pendingPath, "utf8");
  const contentLines = content
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("---");
    });

  return `Pending inbox migration: user/inbox.md.pending-migration exists (${contentLines.length} content lines). Process per step 4.`;
}

export function formatUpcomingRemindersBlock(reminders: UpcomingReminder[]): string {
  if (reminders.length === 0) {
    return "Upcoming items (within 24h of run date):\nNo dated items due within 24h.";
  }

  const lines = ["Upcoming items (within 24h of run date):"];
  for (const item of reminders) {
    const label = item.source === "tasks" ? "From tasks" : "From Active context";
    lines.push(`- ${label}: ${item.line}`);
  }
  return lines.join("\n");
}

export function extractDaySummaryKeyThemes(content: string): string | null {
  const match = content.match(/\*\*Key themes:\*\*\s*(.+)/i);
  return match?.[1]?.trim() ?? null;
}

export function updateLogsIndexFromDaySummary(rootDir: string, date: string): void {
  const logPath = dailyLogPath(rootDir, date);
  if (!existsSync(logPath)) return;

  const themes = extractDaySummaryKeyThemes(readFileSync(logPath, "utf8"));
  if (!themes) return;

  updateLogsIndexEntry(rootDir, date, "active", themes);
}
