// backends/hebbian-report.ts — Hebbian promotion data for consolidation prompts.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { addDays, toIsoDay } from "../shared/dates";
import { HEBBIAN_DEMOTION_MIN_SESSIONS, HEBBIAN_RECENT_DAYS } from "../shared/defaults";
import { parseFrontmatter } from "../shared/frontmatter";
import { brainDirPath, logsIndexPath } from "./brain-paths";
import { BRAIN, BRAIN_PREFIX, BRAIN_SUBDIRS, INDEX_SUFFIX, dirPrefix } from "../shared/brain-paths";

const LOG_INDEX_ACTIVE_RE = /^-\s+(\d{4}-\d{2}-\d{2}):\s+active\b/;

const BRAIN_EXCLUDED_PREFIXES = [
  dirPrefix(BRAIN_SUBDIRS.identity),
  dirPrefix(BRAIN_SUBDIRS.skills),
  dirPrefix(BRAIN_SUBDIRS.archive),
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

function isBrainTracked(relPath: string): boolean {
  if (!relPath.startsWith(BRAIN_PREFIX) || !relPath.endsWith(".md")) return false;
  if (relPath.endsWith(INDEX_SUFFIX) || relPath === BRAIN.index) return false;
  if (relPath === BRAIN.observations || relPath === BRAIN.deferred) {
    return false;
  }
  return !BRAIN_EXCLUDED_PREFIXES.some((prefix) => relPath.startsWith(prefix));
}

function walkBrainFiles(rootDir: string): string[] {
  const brainDir = brainDirPath(rootDir);
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
  const indexPath = logsIndexPath(rootDir);
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
  const weekAgo = addDays(today, -HEBBIAN_RECENT_DAYS);

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
    `Active sessions total: ${report.activeSessions} | Recent (${HEBBIAN_RECENT_DAYS}d): ${report.recentActiveSessions}`,
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
    (file) => file.lastAccessed && file.activeSessionsSince >= HEBBIAN_DEMOTION_MIN_SESSIONS,
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
