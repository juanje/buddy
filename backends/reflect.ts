// backends/reflect.ts — Pending skeletons and daily agent logs (FR-REFLECT-01/02/03).

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PENDING_DIR } from "../shared/defaults";
import { formatLocalTime, toIsoDay } from "../shared/dates";
import type { SessionTrackerSnapshot } from "./session-tracker";

export interface PendingReflect {
  path: string;
  date: string;
  sessionId: string;
}

export type LogStatus = "active" | "maintenance";

export interface DailyLogAppend {
  date: string;
  sessionHeader: string;
  sections: string;
  blockKind?: "session" | "checkpoint";
  status?: LogStatus;
}

export interface FinalizeReflectOptions {
  rootDir: string;
  skeletonPath: string;
  skeletonContent: string;
  sections: string;
}

export interface FinalizeCheckpointOptions {
  rootDir: string;
  date: string;
  checkpointTime: string;
  sections: string;
}

function isoDay(date: Date): string {
  return toIsoDay(date);
}

export function formatToolCalls(toolCalls: SessionTrackerSnapshot["toolCalls"]): string {
  if (toolCalls.length === 0) return "(none)\n";
  return toolCalls
    .map((t) => {
      const time = formatLocalTime(t.timestamp);
      const target = t.path ? ` ${t.path}` : "";
      return `- ${time} ${t.name}${target}`;
    })
    .join("\n");
}

export function formatSkeletonBody(snapshot: SessionTrackerSnapshot): string {
  const date = isoDay(new Date(snapshot.startTime));
  const startTime = formatLocalTime(snapshot.startTime);
  const endTime = formatLocalTime(snapshot.endTime);
  const lines = [
    `# Session — ${date} (${startTime}–${endTime}, ${snapshot.turnCount} turns)`,
    "",
    "## Files written",
    snapshot.filesWritten.length ? snapshot.filesWritten.map((f) => `- ${f}`).join("\n") : "(none)",
    "",
    "## Files read",
    snapshot.filesRead.length ? snapshot.filesRead.map((f) => `- ${f}`).join("\n") : "(none)",
    "",
    "## Tool calls",
    formatToolCalls(snapshot.toolCalls).trimEnd(),
  ];
  return lines.join("\n") + "\n";
}

export function formatSkeletonFrontmatter(snapshot: SessionTrackerSnapshot): string {
  const date = isoDay(new Date(snapshot.startTime));
  return [
    "---",
    `date: ${date}`,
    `session_id: ${snapshot.sessionId}`,
    "status: reflect-pending",
    `start: ${snapshot.startTime}`,
    `end: ${snapshot.endTime}`,
    `turns: ${snapshot.turnCount}`,
    "---",
    "",
  ].join("\n");
}

export function pendingSkeletonPath(rootDir: string, sessionId: string): string {
  return join(rootDir, PENDING_DIR, `${sessionId}.md`);
}

/** Write internal reflect skeleton to `.buddy/pending/{sessionId}.md`. */
export function savePendingSkeleton(rootDir: string, snapshot: SessionTrackerSnapshot): string {
  const pendingDir = join(rootDir, PENDING_DIR);
  mkdirSync(pendingDir, { recursive: true });
  const path = pendingSkeletonPath(rootDir, snapshot.sessionId);
  writeFileSync(path, formatSkeletonFrontmatter(snapshot) + formatSkeletonBody(snapshot), "utf8");
  return path;
}

export function deletePendingSkeleton(pendingPath: string): void {
  if (existsSync(pendingPath)) rmSync(pendingPath);
}

export function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const fields: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return fields;
}

export function sessionHeaderFromSkeleton(content: string): string {
  const fm = parseFrontmatter(content);
  if (fm.start && fm.end) {
    const start = formatLocalTime(fm.start);
    const end = formatLocalTime(fm.end);
    return `${start}–${end}`;
  }
  const bodyMatch = content.match(/\((\d{2}:\d{2})–(\d{2}:\d{2})/);
  if (bodyMatch) return `${bodyMatch[1]}–${bodyMatch[2]}`;
  return "session";
}

/** Scan `.buddy/pending/` for skeletons awaiting reflect. */
export function findPendingReflects(rootDir: string): PendingReflect[] {
  const pendingDir = join(rootDir, PENDING_DIR);
  if (!existsSync(pendingDir)) return [];
  const pending: PendingReflect[] = [];
  for (const name of readdirSync(pendingDir)) {
    if (!name.endsWith(".md")) continue;
    const path = join(pendingDir, name);
    const fm = parseFrontmatter(readFileSync(path, "utf8"));
    if (fm.status !== "reflect-pending") continue;
    pending.push({
      path,
      date: fm.date ?? name.slice(0, 10),
      sessionId: fm.session_id ?? name.replace(/\.md$/, ""),
    });
  }
  return pending.sort((a, b) => a.date.localeCompare(b.date) || a.path.localeCompare(b.path));
}

function updateLastUpdatedFrontmatter(content: string, now: Date): string {
  const stamp = now.toISOString().slice(0, 16);
  if (/^last_updated:/m.test(content)) {
    return content.replace(/^last_updated:.*$/m, `last_updated: ${stamp}`);
  }
  return content.replace(/^---\r?\n([\s\S]*?)\r?\n---/, (_, body: string) => {
    return `---\n${body.trimEnd()}\nlast_updated: ${stamp}\n---`;
  });
}

/**
 * Append reflect output to `logs/YYYY-MM-DD.md` in process-conversation-compatible format.
 */
export function appendDailyLog(rootDir: string, append: DailyLogAppend, now = new Date()): string {
  const logsDir = join(rootDir, "logs");
  mkdirSync(logsDir, { recursive: true });
  const logPath = join(logsDir, `${append.date}.md`);
  const blockKind = append.blockKind ?? "session";
  const status = append.status ?? "active";
  const heading =
    blockKind === "checkpoint"
      ? `## Checkpoint ${append.sessionHeader}`
      : `## Session ${append.sessionHeader}`;
  const sessionBlock = `${heading}\n\n${append.sections.trim()}\n`;

  if (existsSync(logPath)) {
    const existing = readFileSync(logPath, "utf8");
    writeFileSync(logPath, updateLastUpdatedFrontmatter(existing, now).trimEnd() + "\n\n" + sessionBlock, "utf8");
  } else {
    const stamp = now.toISOString().slice(0, 16);
    writeFileSync(
      logPath,
      [
        "---",
        `date: ${append.date}`,
        `status: ${status}`,
        `last_updated: ${stamp}`,
        "---",
        "",
        `# Log — ${append.date}`,
        "",
        sessionBlock,
      ].join("\n"),
      "utf8",
    );
  }
  return logPath;
}

/** Append reflect output to daily log and remove the pending skeleton. */
export function finalizeReflectToDailyLog(options: FinalizeReflectOptions): string {
  const { rootDir, skeletonPath, skeletonContent, sections } = options;
  const fm = parseFrontmatter(skeletonContent);
  const date = fm.date ?? new Date().toISOString().slice(0, 10);
  const dailyPath = appendDailyLog(rootDir, {
    date,
    sessionHeader: sessionHeaderFromSkeleton(skeletonContent),
    sections,
  });
  deletePendingSkeleton(skeletonPath);
  return dailyPath;
}

/** Append checkpoint reflect output to the daily log and update its index entry. */
export function finalizeCheckpointToDailyLog(options: FinalizeCheckpointOptions): string {
  const { rootDir, date, checkpointTime, sections } = options;
  const dailyPath = appendDailyLog(rootDir, {
    date,
    sessionHeader: checkpointTime,
    sections,
    blockKind: "checkpoint",
  });
  updateLogsIndexEntry(rootDir, date);
  return dailyPath;
}

const INDEX_HEADER = "# Sessions index\n\nLog files: `logs/YYYY-MM-DD.md` (derive from the date in each entry).\n";

/**
 * Incremental index update: add or replace only the entry for `date`,
 * preserving all other lines (archived entries, date ranges, curated summaries).
 * Creates the index with standard header if it doesn't exist.
 */
export function updateLogsIndexEntry(rootDir: string, date: string, status: LogStatus = "active"): void {
  const logsDir = join(rootDir, "logs");
  mkdirSync(logsDir, { recursive: true });
  const indexPath = join(logsDir, "index.md");

  const logPath = join(logsDir, `${date}.md`);
  const summary = existsSync(logPath)
    ? extractOneLinerSummary(readFileSync(logPath, "utf8"))
    : "(no summary)";

  const newLine = `- ${date}: ${status} — ${summary}`;
  const entryPattern = new RegExp(`^- ${date}:.*$`, "m");

  if (!existsSync(indexPath)) {
    writeFileSync(indexPath, `${INDEX_HEADER}\n${newLine}\n`, "utf8");
    return;
  }

  const existing = readFileSync(indexPath, "utf8");

  if (entryPattern.test(existing)) {
    const currentLine = existing.match(entryPattern)![0];
    if (currentLine.includes(": active") && status === "maintenance") {
      const preservedLine = `- ${date}: active — ${summary}`;
      writeFileSync(indexPath, existing.replace(entryPattern, preservedLine), "utf8");
      return;
    }
    writeFileSync(indexPath, existing.replace(entryPattern, newLine), "utf8");
    return;
  }

  const lines = existing.trimEnd().split("\n");
  const entryLines: Array<{ idx: number; date: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^- (\d{4}-\d{2}-\d{2})/.exec(lines[i]);
    if (m) entryLines.push({ idx: i, date: m[1] });
  }

  let insertAt = lines.length;
  for (const entry of entryLines) {
    if (date < entry.date) {
      insertAt = entry.idx;
      break;
    }
    insertAt = entry.idx + 1;
  }

  lines.splice(insertAt, 0, newLine);
  writeFileSync(indexPath, lines.join("\n") + "\n", "utf8");
}


function extractOneLinerSummary(content: string): string {
  const contextMatch = content.match(/### Context\r?\n([\s\S]*?)(?=\r?\n###|\r?\n##|\r?\n$)/);
  if (contextMatch) {
    const firstLine = contextMatch[1].trim().split("\n").find((l) => l.trim().length > 0);
    if (firstLine) return firstLine.replace(/^-\s*/, "").trim();
  }
  const legacyContext = content.match(/## Context\r?\n([\s\S]*?)(?=\r?\n##|\r?\n$)/);
  if (legacyContext) {
    const firstLine = legacyContext[1].trim().split("\n").find((l) => l.trim().length > 0);
    if (firstLine) return firstLine.replace(/^-\s*/, "").trim();
  }
  return "(no summary)";
}

export function shouldRunCheckpointReflect(
  turnCount: number,
  every: number,
  lastCheckpointTurn: number,
): boolean {
  return every > 0 && turnCount > 0 && turnCount !== lastCheckpointTurn && turnCount % every === 0;
}

/** Strip raw tool-call syntax leaked into LLM reflect output (FR-REFLECT-04). */
const TOOL_LEAK_PATTERNS: RegExp[] = [
  /^to=functions\.\w+.*$/gm,
  /^```json\s*\n\{[^}]*"path"[^}]*\}\s*\n```$/gm,
  /^\{"name":"(read|write|edit|ls|find|grep)".*\}$/gm,
];

export function sanitizeReflectOutput(text: string): string {
  let result = text;
  for (const pattern of TOOL_LEAK_PATTERNS) {
    result = result.replace(pattern, "");
  }
  return result.replace(/\n{3,}/g, "\n\n").trim();
}
