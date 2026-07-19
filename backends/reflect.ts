// backends/reflect.ts — Factual skeletons, log index, incremental snapshots (FR-REFLECT-01/03).

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { SessionSegment, SessionTrackerSnapshot } from "./session-tracker";
import { toIsoDay } from "../shared/dates";

export interface PendingReflect {
  path: string;
  date: string;
  sessionId: string;
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
  const date = isoDay(new Date(snapshot.endTime));
  const startTime = snapshot.startTime.slice(11, 16);
  const endTime = snapshot.endTime.slice(11, 16);
  return `# Session — ${date} (${startTime}–${endTime}, ${snapshot.turnCount} turns)\n`;
}

export function formatSkeletonFrontmatter(snapshot: SessionTrackerSnapshot): string {
  const date = isoDay(new Date(snapshot.endTime));
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

export function sessionLogPath(abDirectory: string, snapshot: SessionTrackerSnapshot): string {
  const date = isoDay(new Date(snapshot.endTime));
  return join(abDirectory, "logs", `${date}_${snapshot.sessionId}.md`);
}

export function saveSessionSkeleton(abDirectory: string, snapshot: SessionTrackerSnapshot): string {
  const logsDir = join(abDirectory, "logs");
  mkdirSync(logsDir, { recursive: true });
  const path = sessionLogPath(abDirectory, snapshot);
  writeFileSync(path, formatSkeletonFrontmatter(snapshot) + formatSkeletonBody(snapshot), "utf8");
  return path;
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

export function findPendingReflects(abDirectory: string): PendingReflect[] {
  const logsDir = join(abDirectory, "logs");
  if (!existsSync(logsDir)) return [];
  const pending: PendingReflect[] = [];
  for (const name of readdirSync(logsDir)) {
    if (!name.endsWith(".md") || name === "index.md") continue;
    const path = join(logsDir, name);
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

export function markReflectComplete(logPath: string, sections: string): void {
  const content = readFileSync(logPath, "utf8");
  const updated = content.replace(/^status:\s*reflect-pending/m, "status: complete");
  const body = updated.includes("## Reflect summary")
    ? updated
    : `${updated.trimEnd()}\n\n## Reflect summary\n\n${sections.trim()}\n`;
  writeFileSync(logPath, body, "utf8");
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
      date: fm.date ?? name.slice(0, 10),
      summary,
      file: name,
    });
  }

  entries.sort((a, b) => b.date.localeCompare(a.date) || b.file.localeCompare(a.file));
  const lines = [
    "# Session logs",
    "",
    "Per-session: `logs/YYYY-MM-DD_SESSIONID.md` — after daily consolidation: `logs/YYYY-MM-DD.md`.",
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
  const contextMatch = content.match(/### Context\r?\n([\s\S]*?)(?=\r?\n###|\r?\n$)/);
  if (contextMatch) {
    const firstLine = contextMatch[1].trim().split("\n")[0].trim();
    if (firstLine.length > 0) return firstLine;
  }
  const fm = parseFrontmatter(content);
  if (fm.status === "reflect-pending") return "(reflect pending)";
  return "(no summary)";
}

export function shouldRunIncrementalReflect(
  turnCount: number,
  every: number,
  lastSnapshotTurn: number,
): boolean {
  return every > 0 && turnCount > 0 && turnCount !== lastSnapshotTurn && turnCount % every === 0;
}
