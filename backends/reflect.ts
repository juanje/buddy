// backends/reflect.ts — Pending skeletons and daily agent logs (FR-REFLECT-01/02/03).

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PENDING_DIR } from "../shared/defaults";
import { toIsoDay } from "../shared/dates";
import type { SessionTrackerSnapshot } from "./session-tracker";

export interface PendingReflect {
  path: string;
  date: string;
  sessionId: string;
}

export interface DailyLogAppend {
  date: string;
  sessionHeader: string;
  sections: string;
  blockKind?: "session" | "checkpoint";
}

export interface FinalizeReflectOptions {
  abDirectory: string;
  skeletonPath: string;
  skeletonContent: string;
  sections: string;
}

export interface FinalizeCheckpointOptions {
  abDirectory: string;
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
      const time = t.timestamp.slice(11, 16);
      const target = t.path ? ` ${t.path}` : "";
      return `- ${time} ${t.name}${target}`;
    })
    .join("\n");
}

export function formatSkeletonBody(snapshot: SessionTrackerSnapshot): string {
  const date = isoDay(new Date(snapshot.startTime));
  const startTime = snapshot.startTime.slice(11, 16);
  const endTime = snapshot.endTime.slice(11, 16);
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

export function pendingSkeletonPath(abDirectory: string, sessionId: string): string {
  return join(abDirectory, PENDING_DIR, `${sessionId}.md`);
}

/** Write internal reflect skeleton to `.ab-app/pending/{sessionId}.md`. */
export function savePendingSkeleton(abDirectory: string, snapshot: SessionTrackerSnapshot): string {
  const pendingDir = join(abDirectory, PENDING_DIR);
  mkdirSync(pendingDir, { recursive: true });
  const path = pendingSkeletonPath(abDirectory, snapshot.sessionId);
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
    const start = fm.start.slice(11, 16);
    const end = fm.end.slice(11, 16);
    return `${start}–${end}`;
  }
  const bodyMatch = content.match(/\((\d{2}:\d{2})–(\d{2}:\d{2})/);
  if (bodyMatch) return `${bodyMatch[1]}–${bodyMatch[2]}`;
  return "session";
}

/** Scan `.ab-app/pending/` for skeletons awaiting reflect. */
export function findPendingReflects(abDirectory: string): PendingReflect[] {
  const pendingDir = join(abDirectory, PENDING_DIR);
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
export function appendDailyLog(abDirectory: string, append: DailyLogAppend, now = new Date()): string {
  const logsDir = join(abDirectory, "logs");
  mkdirSync(logsDir, { recursive: true });
  const logPath = join(logsDir, `${append.date}.md`);
  const blockKind = append.blockKind ?? "session";
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
  const { abDirectory, skeletonPath, skeletonContent, sections } = options;
  const fm = parseFrontmatter(skeletonContent);
  const date = fm.date ?? new Date().toISOString().slice(0, 10);
  const dailyPath = appendDailyLog(abDirectory, {
    date,
    sessionHeader: sessionHeaderFromSkeleton(skeletonContent),
    sections,
  });
  deletePendingSkeleton(skeletonPath);
  return dailyPath;
}

/** Append checkpoint reflect output to the daily log and rebuild the index. */
export function finalizeCheckpointToDailyLog(options: FinalizeCheckpointOptions): string {
  const { abDirectory, date, checkpointTime, sections } = options;
  const dailyPath = appendDailyLog(abDirectory, {
    date,
    sessionHeader: checkpointTime,
    sections,
    blockKind: "checkpoint",
  });
  rebuildLogsIndex(abDirectory);
  return dailyPath;
}

export function rebuildLogsIndex(abDirectory: string): void {
  const logsDir = join(abDirectory, "logs");
  mkdirSync(logsDir, { recursive: true });
  const entries: Array<{ date: string; summary: string; file: string }> = [];

  for (const name of readdirSync(logsDir)) {
    if (!name.endsWith(".md") || name === "index.md") continue;
    const path = join(logsDir, name);
    const content = readFileSync(path, "utf8");
    const fm = parseFrontmatter(content);
    const summary = extractOneLinerSummary(content);
    entries.push({
      date: fm.date ?? name.replace(/\.md$/, ""),
      summary,
      file: name,
    });
  }

  entries.sort((a, b) => b.date.localeCompare(a.date) || b.file.localeCompare(a.file));
  const lines = [
    "# Session logs",
    "",
    "Daily agent logs: `logs/YYYY-MM-DD.md` (process-conversation format).",
    "Derive path: `logs/{stem}.md` where stem is the first field of each entry.",
    "",
    ...entries.map((e) => {
      const stem = e.file.replace(/\.md$/, "");
      return `- ${stem}: ${e.summary}`;
    }),
    "",
  ];
  writeFileSync(join(logsDir, "index.md"), lines.join("\n"), "utf8");
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
