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
import { join } from "node:path";

import { addDays } from "../shared/dates";
import { LOG_ROTATION_THRESHOLD } from "../shared/defaults";
import { updateLogsIndexEntry } from "./reflect";

const DATE_MARKER_RE = /\b(\d{4}-\d{2}-\d{2})\b/;

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

export function extractDaySummaryKeyThemes(content: string): string | null {
  const match = content.match(/\*\*Key themes:\*\*\s*(.+)/i);
  return match?.[1]?.trim() ?? null;
}

export function updateLogsIndexFromDaySummary(rootDir: string, date: string): void {
  const logPath = join(rootDir, "logs", `${date}.md`);
  if (!existsSync(logPath)) return;

  const themes = extractDaySummaryKeyThemes(readFileSync(logPath, "utf8"));
  if (!themes) return;

  updateLogsIndexEntry(rootDir, date, "active", themes);
}
