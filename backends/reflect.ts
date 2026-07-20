// backends/reflect.ts — Pending skeletons, daily agent logs, incremental snapshots (FR-REFLECT-01/03).

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PENDING_DIR } from "../shared/defaults";
import { toIsoDay } from "../shared/dates";
import type { SessionSegment, SessionTrackerSnapshot } from "./session-tracker";

export interface PendingReflect {
  path: string;
  date: string;
  sessionId: string;
}

export interface DailyLogAppend {
  date: string;
  sessionHeader: string;
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
  return `# Session — ${date} (${startTime}–${endTime}, ${snapshot.turnCount} turns)\n`;
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

export function formatSegmentBody(segment: SessionSegment, encoded?: string): string {
  const lines = [
    `# Incremental snapshot — turns ${segment.startTurn}-${segment.endTurn}`,
    "",
    "## Files written",
    segment.filesWritten.length ? segment.filesWritten.map((f) => `- ${f}`).join("\n") : "(none)",
    "",
    "## Files read",
    segment.filesRead.length ? segment.filesRead.map((f) => `- ${f}`).join("\n") : "(none)",
    "",
    "## Tool calls",
    formatToolCalls(segment.toolCalls).trimEnd(),
  ];
  if (encoded?.trim()) {
    lines.push("", "## Encoding", encoded.trim());
  }
  return lines.join("\n") + "\n";
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

export function snapshotPath(
  abDirectory: string,
  sessionId: string,
  turn: number,
): string {
  const dir = join(abDirectory, ".ab-app", "snapshots");
  mkdirSync(dir, { recursive: true });
  return join(dir, `${sessionId}_${turn}.md`);
}

export function saveIncrementalSnapshot(
  abDirectory: string,
  sessionId: string,
  turn: number,
  segment: SessionSegment,
  encoded?: string,
): string {
  const path = snapshotPath(abDirectory, sessionId, turn);
  writeFileSync(path, formatSegmentBody(segment, encoded), "utf8");
  return path;
}

export function listSnapshots(abDirectory: string, sessionId: string): string[] {
  const dir = join(abDirectory, ".ab-app", "snapshots");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.startsWith(`${sessionId}_`) && name.endsWith(".md"))
    .sort();
}

export function cleanupSnapshots(abDirectory: string, sessionId: string): void {
  for (const name of listSnapshots(abDirectory, sessionId)) {
    rmSync(join(abDirectory, ".ab-app", "snapshots", name));
  }
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
  const sessionBlock = `## Session ${append.sessionHeader}\n\n${append.sections.trim()}\n`;

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

/** Mark an incremental snapshot file with LLM encoding (internal, not agent daily log). */
export function markSnapshotEncoded(snapshotPath: string, sections: string): void {
  const content = readFileSync(snapshotPath, "utf8");
  const body = content.includes("## Encoding")
    ? content
    : `${content.trimEnd()}\n\n## Encoding\n\n${sections.trim()}\n`;
  writeFileSync(snapshotPath, body, "utf8");
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

export function shouldRunIncrementalReflect(
  turnCount: number,
  every: number,
  lastSnapshotTurn: number,
): boolean {
  return every > 0 && turnCount > 0 && turnCount !== lastSnapshotTurn && turnCount % every === 0;
}
