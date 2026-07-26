// backends/reflect.ts — Daily agent logs and reflect finalization (FR-REFLECT-01/02/03).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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
  sessionDate: string;
  sessionHeader: string;
  sections: string;
}

export interface FinalizeCheckpointOptions {
  rootDir: string;
  date: string;
  checkpointTime: string;
  sections: string;
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

/** Append reflect output to daily log using session metadata from spawn args. */
export function finalizeReflectToDailyLog(options: FinalizeReflectOptions): string {
  const { rootDir, sessionDate, sessionHeader, sections } = options;
  return appendDailyLog(rootDir, {
    date: sessionDate,
    sessionHeader,
    sections,
  });
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
export function updateLogsIndexEntry(
  rootDir: string,
  date: string,
  status: LogStatus = "active",
  description?: string,
): void {
  const logsDir = join(rootDir, "logs");
  mkdirSync(logsDir, { recursive: true });
  const indexPath = join(logsDir, "index.md");

  const logPath = join(logsDir, `${date}.md`);
  const summary =
    description ??
    (existsSync(logPath) ? extractOneLinerSummary(readFileSync(logPath, "utf8")) : "(no summary)");

  const newLine = `- ${date}: ${status} — ${summary}`;
  const entryPattern = new RegExp(`^- ${date}:.*$`, "m");

  if (!existsSync(indexPath)) {
    writeFileSync(indexPath, `${INDEX_HEADER}\n${newLine}\n`, "utf8");
    return;
  }

  const existing = readFileSync(indexPath, "utf8");

  if (entryPattern.test(existing)) {
    if (!description) return;
    const currentLine = existing.match(entryPattern)![0];
    if (currentLine.includes(": active") && status === "maintenance") {
      // Same-day maintenance must not replace an active entry's curated description.
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

/** Strip raw tool-call syntax leaked into LLM reflect output (FR-REFLECT-04). */
const TOOL_LEAK_PATTERNS: RegExp[] = [
  /^to=functions\.\w+.*$/gm,
  /^```json\s*\n\{[^}]*"path"[^}]*\}\s*\n```$/gm,
  /^\{"name":"(read|write|edit|ls|find|grep)".*\}$/gm,
];

/** Strip LLM-generated session/checkpoint headers — worker adds the correct one. */
const SESSION_HEADER_RE = /^##\s+(Session|Checkpoint)\s+\S.*\r?\n\r?\n?/;

/** Normalize ## section headings to ### — session heading comes from worker metadata. */
const SECTION_HEADING_RE =
  /^## (Context|Decisions|Tasks captured|Lessons|Open threads|Ideas|System observations)\b/gm;

export function sanitizeReflectOutput(text: string): string {
  let result = text;
  for (const pattern of TOOL_LEAK_PATTERNS) {
    result = result.replace(pattern, "");
  }
  result = result.replace(SESSION_HEADER_RE, "");
  result = result.replace(SECTION_HEADING_RE, "### $1");
  return result.replace(/\n{3,}/g, "\n\n").trim();
}
