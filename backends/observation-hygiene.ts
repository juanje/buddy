// backends/observation-hygiene.ts — Observation hygiene pre-computation (FR-CONSOL-17).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, normalize } from "node:path";

import {
  OBSERVATION_RESOLVED_STALE_DAYS,
  OBSERVATION_SEEN_ONCE_STALE_DAYS,
} from "../shared/defaults";
import { MS_PER_DAY } from "../shared/dates";
import { observationsPath } from "./brain-paths";

export interface ParsedObservation {
  date: string;
  section: string;
  content: string;
  startLine: number;
  endLine: number;
  seenCount: number;
  isResolved: boolean;
  resolvedDate: string | null;
  referencedPaths: string[];
}

export interface StaleObservations {
  resolvedOlderThan60d: ParsedObservation[];
  seenOnceOlderThan90d: ParsedObservation[];
  nonExistentPaths: ParsedObservation[];
}

const OBSERVATION_SECTIONS = [
  "Skill candidates",
  "Rule candidates",
  "Concept candidates",
  "Structure candidates",
  "Process candidates",
] as const;

const ENTRY_START_RE = /^- \*\*(\d{4}-\d{2}-\d{2}):\*\*/;
const SEEN_COUNT_RE = /\(seen:\s*(\d+)\)/gi;
const RESOLVED_RE = /→\s*\*?\*?resolved(?:\s+(\d{4}-\d{2}-\d{2}))?/i;
const LINK_PATH_RE = /\[[^\]]*\]\(([^)]+)\)/g;

function daysBetween(earlier: string, later: Date): number {
  const start = new Date(`${earlier}T12:00:00`);
  if (Number.isNaN(start.getTime())) return 0;
  return Math.floor((later.getTime() - start.getTime()) / MS_PER_DAY);
}

function maxSeenCount(text: string): number {
  let max = 0;
  for (const match of text.matchAll(SEEN_COUNT_RE)) {
    const count = Number.parseInt(match[1] ?? "", 10);
    if (Number.isFinite(count) && count > max) max = count;
  }
  return max;
}

function extractResolvedDate(text: string, entryDate: string): string | null {
  const match = text.match(RESOLVED_RE);
  if (!match) return null;
  return match[1] ?? entryDate;
}

function extractReferencedPaths(text: string): string[] {
  const paths = new Set<string>();
  for (const match of text.matchAll(LINK_PATH_RE)) {
    const raw = match[1]?.trim() ?? "";
    if (!raw || raw.startsWith("http://") || raw.startsWith("https://")) continue;
    paths.add(raw.split("#")[0] ?? raw);
  }
  return [...paths];
}

function resolveObservationPath(rootDir: string, relPath: string): string {
  const cleaned = normalize(relPath.replace(/^\.\//, ""));
  if (cleaned.startsWith("agent_brain/") || cleaned.startsWith("user/") || cleaned.startsWith("logs/")) {
    return join(rootDir, cleaned);
  }
  return join(rootDir, "agent_brain", cleaned);
}

function pathExistsInInstance(rootDir: string, relPath: string): boolean {
  return existsSync(resolveObservationPath(rootDir, relPath));
}

function splitSectionEntries(sectionBody: string, section: string, lineOffset: number): ParsedObservation[] {
  const lines = sectionBody.split("\n");
  const entries: ParsedObservation[] = [];
  let currentLines: string[] = [];
  let startLine = lineOffset;

  const flush = (endLine: number) => {
    if (currentLines.length === 0) return;
    const content = currentLines.join("\n").trim();
    const dateMatch = content.match(ENTRY_START_RE);
    if (!dateMatch?.[1]) {
      currentLines = [];
      return;
    }
    const date = dateMatch[1];
    entries.push({
      date,
      section,
      content,
      startLine,
      endLine: endLine,
      seenCount: maxSeenCount(content),
      isResolved: RESOLVED_RE.test(content),
      resolvedDate: extractResolvedDate(content, date),
      referencedPaths: extractReferencedPaths(content),
    });
    currentLines = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const absoluteLine = lineOffset + i;
    if (ENTRY_START_RE.test(line.trim())) {
      if (currentLines.length > 0) flush(absoluteLine - 1);
      startLine = absoluteLine;
      currentLines = [line];
      continue;
    }
    if (currentLines.length > 0) currentLines.push(line);
  }
  if (currentLines.length > 0) flush(lineOffset + lines.length - 1);
  return entries;
}

export function parseObservations(content: string): ParsedObservation[] {
  const parsed: ParsedObservation[] = [];
  const lines = content.split("\n");

  for (const section of OBSERVATION_SECTIONS) {
    const heading = `## ${section}`;
    const headingIndex = lines.findIndex((line) => line.trim() === heading);
    if (headingIndex === -1) continue;

    let endIndex = lines.length;
    for (let i = headingIndex + 1; i < lines.length; i += 1) {
      if (/^## /.test(lines[i] ?? "")) {
        endIndex = i;
        break;
      }
    }

    const sectionBody = lines.slice(headingIndex + 1, endIndex).join("\n");
    parsed.push(...splitSectionEntries(sectionBody, section, headingIndex + 1));
  }

  return parsed;
}

export function computeStaleObservations(
  parsed: ParsedObservation[],
  rootDir: string,
  now: Date = new Date(),
): StaleObservations {
  const resolvedOlderThan60d: ParsedObservation[] = [];
  const seenOnceOlderThan90d: ParsedObservation[] = [];
  const nonExistentPaths: ParsedObservation[] = [];

  for (const entry of parsed) {
    const missingPaths = entry.referencedPaths.filter((path) => !pathExistsInInstance(rootDir, path));
    if (missingPaths.length > 0) {
      nonExistentPaths.push(entry);
      continue;
    }

    if (entry.isResolved && entry.resolvedDate) {
      if (daysBetween(entry.resolvedDate, now) > OBSERVATION_RESOLVED_STALE_DAYS) {
        resolvedOlderThan60d.push(entry);
      }
      continue;
    }

    if (!entry.isResolved && entry.seenCount <= 1) {
      if (daysBetween(entry.date, now) > OBSERVATION_SEEN_ONCE_STALE_DAYS) {
        seenOnceOlderThan90d.push(entry);
      }
    }
  }

  return { resolvedOlderThan60d, seenOnceOlderThan90d, nonExistentPaths };
}

export function removeObservationEntries(content: string, entries: ParsedObservation[]): string {
  if (entries.length === 0) return content;
  const lines = content.split("\n");
  const toRemove = new Set<number>();
  for (const entry of entries) {
    for (let line = entry.startLine; line <= entry.endLine; line += 1) {
      toRemove.add(line);
    }
  }
  return lines.filter((_, index) => !toRemove.has(index)).join("\n");
}

export function formatStaleObservationsBlock(stale: StaleObservations): string {
  const total =
    stale.resolvedOlderThan60d.length +
    stale.seenOnceOlderThan90d.length +
    stale.nonExistentPaths.length;
  if (total === 0) {
    return "Stale observations (hygiene candidates):\nNone identified.";
  }

  const lines = ["Stale observations (hygiene candidates):"];

  if (stale.nonExistentPaths.length > 0) {
    lines.push(`Non-existent paths (${stale.nonExistentPaths.length}, auto-removed by runner):`);
    for (const entry of stale.nonExistentPaths.slice(0, 20)) {
      lines.push(`- [${entry.section}] ${entry.content.split("\n")[0]}`);
    }
  }

  if (stale.resolvedOlderThan60d.length > 0) {
    lines.push(`Resolved >${OBSERVATION_RESOLVED_STALE_DAYS}d (${stale.resolvedOlderThan60d.length}):`);
    for (const entry of stale.resolvedOlderThan60d.slice(0, 20)) {
      lines.push(`- [${entry.section}] ${entry.content.split("\n")[0]}`);
    }
  }

  if (stale.seenOnceOlderThan90d.length > 0) {
    lines.push(`Seen:1 >${OBSERVATION_SEEN_ONCE_STALE_DAYS}d (${stale.seenOnceOlderThan90d.length}):`);
    for (const entry of stale.seenOnceOlderThan90d.slice(0, 20)) {
      lines.push(`- [${entry.section}] ${entry.content.split("\n")[0]}`);
    }
  }

  return lines.join("\n");
}

export interface ObservationHygieneResult {
  stale: StaleObservations;
  removedCount: number;
  updatedContent: string;
}

/** Parse, auto-remove non-existent-path entries, and return stale lists for the prompt. */
export function runObservationHygiene(rootDir: string, now: Date = new Date()): ObservationHygieneResult {
  const path = observationsPath(rootDir);
  if (!existsSync(path)) {
    return {
      stale: { resolvedOlderThan60d: [], seenOnceOlderThan90d: [], nonExistentPaths: [] },
      removedCount: 0,
      updatedContent: "",
    };
  }

  const original = readFileSync(path, "utf8");
  const parsed = parseObservations(original);
  const stale = computeStaleObservations(parsed, rootDir, now);
  const updatedContent = removeObservationEntries(original, stale.nonExistentPaths);
  if (stale.nonExistentPaths.length > 0) {
    writeFileSync(path, updatedContent.endsWith("\n") ? updatedContent : `${updatedContent}\n`);
  }

  return {
    stale: {
      ...stale,
      nonExistentPaths: stale.nonExistentPaths,
    },
    removedCount: stale.nonExistentPaths.length,
    updatedContent: stale.nonExistentPaths.length > 0 ? updatedContent : original,
  };
}
