// backends/daily-coherence.ts — Daily coherence detection (FR-CONSOL-20).

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { toIsoDay } from "../shared/dates";
import { dailyLogPath, deferredPath } from "./brain-paths";
import { extractRightNowSection } from "./consolidation-snapshot";

export interface StalenessFlag {
  rightNowItem: string;
  logKeyword: string;
  reason: string;
}

export interface ResolvedDeferredFlag {
  deferredLine: string;
  logEvidence: string;
}

export interface TaskCoherenceFlag {
  line: string;
  logEvidence: string;
}

export interface DailyCoherenceResult {
  rightNowContent: string;
  logDecisions: string[];
  stalenessFlags: StalenessFlag[];
  resolvedDeferred: ResolvedDeferredFlag[];
  taskFlags: TaskCoherenceFlag[];
}

const DECISIONS_HEADING_RE = /^### Decisions\b/m;
const COMPLETION_KEYWORDS = [
  "complete",
  "completed",
  "done",
  "shipped",
  "finished",
  "resolved",
  "closed",
  "merged",
  "completado",
  "terminado",
  "cerrado",
];

function readAgentsMd(rootDir: string): string {
  const path = `${rootDir}/AGENTS.md`;
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8");
}

function readTodayLog(rootDir: string, now: Date): string {
  const path = dailyLogPath(rootDir, toIsoDay(now));
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8");
}

export function extractLogDecisions(logContent: string): string[] {
  const match = logContent.match(DECISIONS_HEADING_RE);
  if (!match || match.index == null) return [];

  const fromDecisions = logContent.slice(match.index + match[0].length);
  const nextHeading = fromDecisions.search(/^### /m);
  const section = nextHeading === -1 ? fromDecisions : fromDecisions.slice(0, nextHeading);

  const keywords = new Set<string>();
  for (const line of section.split("\n")) {
    const trimmed = line.replace(/^[-*]\s+/, "").trim();
    if (!trimmed) continue;
    const words = trimmed
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 4);
    for (const word of words) keywords.add(word);
    if (trimmed.length >= 8) keywords.add(trimmed.slice(0, 80).toLowerCase());
  }
  return [...keywords];
}

export function detectRightNowStaleness(
  rightNow: string,
  logDecisions: string[],
): StalenessFlag[] {
  const flags: StalenessFlag[] = [];
  const logText = logDecisions.join(" ");

  for (const line of rightNow.split("\n")) {
    const item = line.replace(/^[-*]\s+/, "").trim();
    if (!item) continue;

    for (const keyword of logDecisions) {
      if (keyword.length < 5) continue;
      const itemLower = item.toLowerCase();
      if (!itemLower.includes(keyword)) continue;

      const mentionsCompletion = COMPLETION_KEYWORDS.some((word) => logText.includes(word));
      if (!mentionsCompletion) continue;

      flags.push({
        rightNowItem: item,
        logKeyword: keyword,
        reason: "Today's log mentions completion-related terms alongside this Right now item",
      });
      break;
    }
  }

  return flags;
}

export function detectResolvedDeferred(
  deferredContent: string,
  logContent: string,
): ResolvedDeferredFlag[] {
  const flags: ResolvedDeferredFlag[] = [];
  const logLower = logContent.toLowerCase();

  for (const line of deferredContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("-")) continue;
    const subject = trimmed.replace(/^-\s*\*\*[^*]+\*\*\s*\([^)]+\):\s*/, "").trim();
    if (!subject || subject.length < 6) continue;

    const tokens = subject
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 5);
    const matched = tokens.find((token) => logLower.includes(token));
    if (!matched) continue;

    const mentionsCompletion = COMPLETION_KEYWORDS.some((word) => logLower.includes(word));
    if (!mentionsCompletion) continue;

    flags.push({
      deferredLine: trimmed,
      logEvidence: `log mentions "${matched}" with completion language`,
    });
  }

  return flags;
}

const PARKED_KEYWORDS = [
  "parked",
  "paused",
  "deferred",
  "postponed",
  "cancelled",
  "dropped",
  "aparcado",
  "pausado",
  "aplazado",
  "cancelado",
];

export function detectTaskCoherence(
  tasksContent: string,
  logContent: string,
): TaskCoherenceFlag[] {
  const flags: TaskCoherenceFlag[] = [];
  const logLower = logContent.toLowerCase();
  if (!logLower.trim()) return flags;

  const logLines = logContent.split("\n").map((line) => line.toLowerCase());

  for (const line of tasksContent.split("\n")) {
    const trimmed = line.trim();
    if (!/^- \[( |x)\]/.test(trimmed) || trimmed.length < 10) continue;

    const itemText = trimmed
      .replace(/^- \[( |x)\] (>> )?/, "")
      .replace(/\s*\*\*[^*]+\*\*/, "")
      .replace(/\s*@[\w-]+\s*$/, "")
      .replace(/\s*#[\w-]+/g, "")
      .replace(/<!--[^>]*-->/g, "")
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "")
      .trim();

    const tokens = itemText
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 7);

    const matched = tokens.find((token) => logLower.includes(token));
    if (!matched) continue;

    const matchedLines = logLines.filter((entry) => entry.includes(matched));
    const completionNearby = matchedLines.some((entry) =>
      COMPLETION_KEYWORDS.some((word) => entry.includes(word)),
    );
    const parkedNearby = matchedLines.some((entry) =>
      PARKED_KEYWORDS.some((word) => entry.includes(word)),
    );
    if (!completionNearby && !parkedNearby) continue;

    const reason = completionNearby
      ? `log mentions "${matched}" with completion language`
      : `log mentions "${matched}" with parking/deferral language`;

    flags.push({ line: trimmed, logEvidence: reason });
  }

  return flags;
}

/** @deprecated Use detectTaskCoherence */
export const detectInboxCoherence = detectTaskCoherence;

export function computeDailyCoherence(rootDir: string, now: Date = new Date()): DailyCoherenceResult {
  const rightNowContent = extractRightNowSection(readAgentsMd(rootDir));
  const logContent = readTodayLog(rootDir, now);
  const logDecisions = extractLogDecisions(logContent);

  let deferredContent = "";
  const deferredFile = deferredPath(rootDir);
  if (existsSync(deferredFile)) deferredContent = readFileSync(deferredFile, "utf8");

  let tasksContent = "";
  const tasksFile = join(rootDir, "user", "tasks.md");
  if (existsSync(tasksFile)) tasksContent = readFileSync(tasksFile, "utf8");

  return {
    rightNowContent,
    logDecisions,
    stalenessFlags: detectRightNowStaleness(rightNowContent, logDecisions),
    resolvedDeferred: detectResolvedDeferred(deferredContent, logContent),
    taskFlags: detectTaskCoherence(tasksContent, logContent),
  };
}

export function formatDailyCoherenceBlock(result: DailyCoherenceResult): string {
  if (
    result.stalenessFlags.length === 0 &&
    result.resolvedDeferred.length === 0 &&
    result.taskFlags.length === 0 &&
    result.logDecisions.length === 0 &&
    !result.rightNowContent.trim()
  ) {
    return "Daily coherence data:\nNo divergence detected between today's log and active context.";
  }

  const lines = ["Daily coherence data:"];

  if (result.rightNowContent.trim()) {
    lines.push("Current Right now items (preserve all at depth 1 — only add/update, never remove):");
    for (const line of result.rightNowContent.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("-")) lines.push(`  ${trimmed}`);
    }
  }

  if (result.logDecisions.length > 0) {
    lines.push(`Decision keywords from today's log: ${result.logDecisions.slice(0, 12).join(", ")}`);
  }

  if (result.stalenessFlags.length > 0) {
    lines.push("Potential Right now staleness:");
    for (const flag of result.stalenessFlags) {
      lines.push(`- "${flag.rightNowItem}" — ${flag.reason} (keyword: ${flag.logKeyword})`);
    }
  }

  if (result.resolvedDeferred.length > 0) {
    lines.push("Deferred items potentially resolved today:");
    for (const flag of result.resolvedDeferred) {
      lines.push(`- ${flag.deferredLine} — ${flag.logEvidence}`);
    }
  }

  if (result.taskFlags.length > 0) {
    lines.push("Task items potentially resolved or parked (update via tasks() tool):");
    for (const flag of result.taskFlags) {
      lines.push(`- ${flag.line} — ${flag.logEvidence}`);
    }
  }

  if (result.stalenessFlags.length === 0 && result.resolvedDeferred.length === 0 && result.taskFlags.length === 0) {
    lines.push("No staleness or deferred-resolution flags detected.");
  }

  return lines.join("\n");
}
