// backends/consolidation-mechanics.ts — Deterministic consolidation helpers (Part 1 brain fixes).

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";

import { addDays, toIsoDay } from "../shared/dates";
import { LOG_ROTATION_THRESHOLD } from "../shared/defaults";
import { parseFrontmatter } from "./reflect";

export { LOG_ROTATION_THRESHOLD } from "../shared/defaults";

const DATE_MARKER_RE = /\b(\d{4}-\d{2}-\d{2})\b/;
const LOG_INDEX_ACTIVE_RE = /^-\s+(\d{4}-\d{2}-\d{2}):\s+active\b/;

const BRAIN_EXCLUDED_PREFIXES = [
  "agent_brain/identity/",
  "agent_brain/skills/",
  "agent_brain/archive/",
];

export interface HebbianFileInfo {
  path: string;
  accessCount: number;
  lastAccessed: string;
  activeSessionsSince: number;
}

export interface HebbianReport {
  activeSessions: number;
  recentActiveSessions: number;
  files: HebbianFileInfo[];
}

export interface UpcomingReminder {
  source: "inbox" | "active-context";
  line: string;
}

function listLogFiles(logsDir: string): string[] {
  if (!existsSync(logsDir)) return [];
  return readdirSync(logsDir)
    .filter((f) => f.endsWith(".md") && f !== "index.md" && !f.startsWith("monthly_"))
    .sort();
}

export function rotateLogs(rootDir: string, targetDate: string): { archived: string[] } {
  const logsDir = join(rootDir, "logs");
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

function isBrainTracked(relPath: string): boolean {
  if (!relPath.startsWith("agent_brain/") || !relPath.endsWith(".md")) return false;
  if (relPath.endsWith("/index.md") || relPath === "agent_brain/index.md") return false;
  if (relPath === "agent_brain/observations.md" || relPath === "agent_brain/deferred.md") {
    return false;
  }
  return !BRAIN_EXCLUDED_PREFIXES.some((prefix) => relPath.startsWith(prefix));
}

function walkBrainFiles(rootDir: string): string[] {
  const brainDir = join(rootDir, "agent_brain");
  if (!existsSync(brainDir)) return [];

  const results: string[] = [];
  const stack = [brainDir];

  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of readdirSync(current)) {
      const abs = join(current, entry);
      const rel = relative(rootDir, abs).replace(/\\/g, "/");
      if (statSync(abs).isDirectory()) {
        stack.push(abs);
      } else if (isBrainTracked(rel)) {
        results.push(rel);
      }
    }
  }

  return results.sort();
}

function readLogsIndex(rootDir: string): string {
  const indexPath = join(rootDir, "logs", "index.md");
  if (!existsSync(indexPath)) return "";
  return readFileSync(indexPath, "utf8");
}

function parseActiveSessionDates(indexContent: string): string[] {
  const dates: string[] = [];
  for (const line of indexContent.split("\n")) {
    const match = LOG_INDEX_ACTIVE_RE.exec(line.trim());
    if (match) dates.push(match[1]);
  }
  return dates;
}

function countActiveSessionsSince(activeDates: string[], sinceDate: string): number {
  return activeDates.filter((date) => date > sinceDate).length;
}

export function computeHebbianReport(rootDir: string, now: Date = new Date()): HebbianReport {
  const indexContent = readLogsIndex(rootDir);
  const activeDates = parseActiveSessionDates(indexContent);
  const today = toIsoDay(now);
  const weekAgo = addDays(today, -7);

  const recentActiveSessions = activeDates.filter((date) => date >= weekAgo).length;

  const files: HebbianFileInfo[] = [];
  for (const relPath of walkBrainFiles(rootDir)) {
    const absPath = join(rootDir, relPath);
    if (!existsSync(absPath)) continue;

    const content = readFileSync(absPath, "utf8");
    const fields = parseFrontmatter(content);
    if (!("access_count" in fields)) continue;

    const accessCount = Number.parseInt(fields.access_count, 10);
    const lastAccessed = fields.last_accessed ?? "";
    const activeSessionsSince = lastAccessed
      ? countActiveSessionsSince(activeDates, lastAccessed)
      : 0;

    files.push({
      path: relPath,
      accessCount: Number.isFinite(accessCount) ? accessCount : 0,
      lastAccessed,
      activeSessionsSince,
    });
  }

  files.sort((a, b) => b.accessCount - a.accessCount);

  return {
    activeSessions: activeDates.length,
    recentActiveSessions,
    files,
  };
}

export function formatHebbianReportBlock(report: HebbianReport): string {
  const lines = [
    "Hebbian promotion data (pre-computed):",
    `Active sessions total: ${report.activeSessions} | Recent (7d): ${report.recentActiveSessions}`,
  ];

  if (report.files.length === 0) {
    lines.push("No tracked brain files with access metadata.");
    return lines.join("\n");
  }

  lines.push("Files with access metadata:");
  for (const file of report.files) {
    const since =
      file.lastAccessed.length > 0
        ? `, active sessions since last access: ${file.activeSessionsSince}`
        : "";
    lines.push(
      `- ${file.path} — access_count: ${file.accessCount}, last_accessed: ${file.lastAccessed || "unknown"}${since}`,
    );
  }

  const demotionCandidates = report.files.filter(
    (file) => file.lastAccessed && file.activeSessionsSince >= 3,
  );
  if (demotionCandidates.length > 0) {
    lines.push("Files without recent access (candidates for demotion):");
    for (const file of demotionCandidates) {
      lines.push(
        `- ${file.path} — access_count: ${file.accessCount}, last_accessed: ${file.lastAccessed} (${file.activeSessionsSince} active sessions since)`,
      );
    }
  }

  return lines.join("\n");
}

export function findDatedInboxItems(rootDir: string, targetDate: string): string[] {
  const inboxPath = join(rootDir, "user", "inbox.md");
  if (!existsSync(inboxPath)) return [];

  const tomorrow = addDays(targetDate, 1);
  const content = readFileSync(inboxPath, "utf8");

  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (!line.startsWith("-")) return false;
      const match = DATE_MARKER_RE.exec(line);
      return match != null && (match[1] === targetDate || match[1] === tomorrow);
    });
}

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
      const match = DATE_MARKER_RE.exec(line);
      return match != null && (match[1] === targetDate || match[1] === tomorrow);
    });
}

export function findUpcomingReminders(rootDir: string, targetDate: string): UpcomingReminder[] {
  const reminders: UpcomingReminder[] = [];

  for (const line of findDatedInboxItems(rootDir, targetDate)) {
    reminders.push({ source: "inbox", line });
  }
  for (const line of findDatedActiveContextItems(rootDir, targetDate)) {
    reminders.push({ source: "active-context", line });
  }

  return reminders;
}

export function formatUpcomingRemindersBlock(reminders: UpcomingReminder[]): string {
  if (reminders.length === 0) {
    return "Upcoming items (within 24h of run date):\nNo dated items due within 24h.";
  }

  const lines = ["Upcoming items (within 24h of run date):"];
  for (const item of reminders) {
    const label = item.source === "inbox" ? "From inbox" : "From Active context";
    lines.push(`- ${label}: ${item.line}`);
  }
  return lines.join("\n");
}
