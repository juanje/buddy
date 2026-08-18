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

export interface InboxCoherenceFlag {
  section: string;
  line: string;
  logEvidence: string;
}

export interface DailyCoherenceResult {
  rightNowContent: string;
  logDecisions: string[];
  stalenessFlags: StalenessFlag[];
  resolvedDeferred: ResolvedDeferredFlag[];
  inboxFlags: InboxCoherenceFlag[];
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

export function detectInboxCoherence(
  inboxContent: string,
  logContent: string,
): InboxCoherenceFlag[] {
  const flags: InboxCoherenceFlag[] = [];
  const logLower = logContent.toLowerCase();
  if (!logLower.trim()) return flags;

  let currentSection = "";
  for (const line of inboxContent.split("\n")) {
    if (/^##\s/.test(line)) {
      currentSection = line.replace(/^##\s+/, "").trim();
      continue;
    }
    if (/^###\s/.test(line)) {
      currentSection = line.replace(/^###\s+/, "").trim();
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed.startsWith("-") || trimmed.length < 10) continue;

    const itemText = trimmed
      .replace(/^-\s*\*\*[^*]+\*\*:?\s*/, "")
      .replace(/\s*\[.*?\]\s*/g, " ")
      .trim();

    const tokens = itemText
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 5);

    const matched = tokens.find((token) => logLower.includes(token));
    if (!matched) continue;

    const completionMatch = COMPLETION_KEYWORDS.some((word) => logLower.includes(word));
    const parkedMatch = PARKED_KEYWORDS.some((word) => logLower.includes(word));
    if (!completionMatch && !parkedMatch) continue;

    const reason = completionMatch
      ? `log mentions "${matched}" with completion language`
      : `log mentions "${matched}" with parking/deferral language`;

    flags.push({ section: currentSection, line: trimmed, logEvidence: reason });
  }

  return flags;
}

export function computeDailyCoherence(rootDir: string, now: Date = new Date()): DailyCoherenceResult {
  const rightNowContent = extractRightNowSection(readAgentsMd(rootDir));
  const logContent = readTodayLog(rootDir, now);
  const logDecisions = extractLogDecisions(logContent);

  let deferredContent = "";
  const deferredFile = deferredPath(rootDir);
  if (existsSync(deferredFile)) deferredContent = readFileSync(deferredFile, "utf8");

  let inboxContent = "";
  const inboxFile = join(rootDir, "user", "inbox.md");
  if (existsSync(inboxFile)) inboxContent = readFileSync(inboxFile, "utf8");

  return {
    rightNowContent,
    logDecisions,
    stalenessFlags: detectRightNowStaleness(rightNowContent, logDecisions),
    resolvedDeferred: detectResolvedDeferred(deferredContent, logContent),
    inboxFlags: detectInboxCoherence(inboxContent, logContent),
  };
}

export function formatDailyCoherenceBlock(result: DailyCoherenceResult): string {
  if (
    result.stalenessFlags.length === 0 &&
    result.resolvedDeferred.length === 0 &&
    result.inboxFlags.length === 0 &&
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

  if (result.inboxFlags.length > 0) {
    lines.push("Inbox items potentially resolved or parked (update/remove from inbox):");
    for (const flag of result.inboxFlags) {
      lines.push(`- [${flag.section}] ${flag.line} — ${flag.logEvidence}`);
    }
  }

  if (result.stalenessFlags.length === 0 && result.resolvedDeferred.length === 0 && result.inboxFlags.length === 0) {
    lines.push("No staleness or deferred-resolution flags detected.");
  }

  return lines.join("\n");
}
