// backends/ripe-observations.ts — Ripe observation extraction for consolidation Step 7.

import { existsSync, readFileSync } from "node:fs";

import { RIPE_OBSERVATION_MIN_SEEN } from "../shared/defaults";
import { observationsPath } from "./brain-paths";

export type RipeObservationCategory =
  | "skill"
  | "rule"
  | "concept"
  | "structure"
  | "process";

export interface RipeObservation {
  category: RipeObservationCategory;
  text: string;
  seenCount: number;
}

const RIPE_OBSERVATION_SECTIONS: Array<{ heading: RegExp; category: RipeObservationCategory }> = [
  { heading: /^## Skill candidates\b/m, category: "skill" },
  { heading: /^## Rule candidates\b/m, category: "rule" },
  { heading: /^## Concept candidates\b/m, category: "concept" },
  { heading: /^## Structure candidates\b/m, category: "structure" },
  { heading: /^## Process candidates\b/m, category: "process" },
];

const SEEN_COUNT_RE = /\(seen:\s*(\d+)\)/gi;
const RESOLVED_MARKER_RE = /→\s*\*\*resolved/i;

function maxSeenCount(text: string): number {
  let max = 0;
  for (const match of text.matchAll(SEEN_COUNT_RE)) {
    const count = Number.parseInt(match[1] ?? "", 10);
    if (Number.isFinite(count) && count > max) max = count;
  }
  return max;
}

function splitObservationEntries(sectionBody: string): string[] {
  const entries: string[] = [];
  let current = "";

  for (const line of sectionBody.split("\n")) {
    if (/^- \*\*\d{4}-\d{2}-\d{2}:\*\*/.test(line.trim())) {
      if (current.trim()) entries.push(current.trim());
      current = line;
      continue;
    }
    if (current) current += `\n${line}`;
  }

  if (current.trim()) entries.push(current.trim());
  return entries;
}

function parseRipeObservationsFromSection(
  sectionBody: string,
  category: RipeObservationCategory,
): RipeObservation[] {
  const ripe: RipeObservation[] = [];

  for (const entry of splitObservationEntries(sectionBody)) {
    if (RESOLVED_MARKER_RE.test(entry)) continue;

    const seenCount = maxSeenCount(entry);
    if (seenCount < RIPE_OBSERVATION_MIN_SEEN) continue;

    const firstLine = entry.split("\n")[0]?.trim() ?? entry;
    ripe.push({ category, text: firstLine, seenCount });
  }

  return ripe;
}

export function extractRipeObservations(rootDir: string): RipeObservation[] {
  const path = observationsPath(rootDir);
  if (!existsSync(path)) return [];

  const content = readFileSync(path, "utf8");
  const ripe: RipeObservation[] = [];

  for (const { heading, category } of RIPE_OBSERVATION_SECTIONS) {
    const match = content.match(heading);
    if (!match || match.index == null) continue;

    const start = match.index + match[0].length;
    const rest = content.slice(start);
    const nextHeading = rest.search(/^## /m);
    const sectionBody = nextHeading === -1 ? rest : rest.slice(0, nextHeading);
    ripe.push(...parseRipeObservationsFromSection(sectionBody, category));
  }

  return ripe;
}

export function formatRipeObservationsBlock(observations: RipeObservation[]): string {
  if (observations.length === 0) {
    return "Ripe observations (Step 7 — act on each):\nNone at seen 2+.";
  }

  const lines = ["Ripe observations (Step 7 — act on each):"];
  for (const obs of observations) {
    lines.push(`- [${obs.category}] (seen: ${obs.seenCount}) ${obs.text}`);
  }
  return lines.join("\n");
}
