// shared/data/consolidation-series.ts — Pending days for consolidation mode (FR-DATA-05).

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse/sync";

import { dailyLogRelPath } from "../brain-paths";
import { addDays, toIsoDay } from "../dates";
import type { DataRegistryEntry } from "./registry";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const LIST_LIMIT = 14;
const EMPTY_CSV_WINDOW_DAYS = 14;

export type ConsolidationSeriesEntryResult =
  | { ok: true; name: string; path: string; inferred: boolean; instructions?: string; pending: string[]; omitted: number }
  | { ok: false; name: string; path: string; reason: string };

function keyColumns(entry: DataRegistryEntry): string[] {
  return Array.isArray(entry.key) ? entry.key : [entry.key];
}

export function dateKeyColumn(entry: DataRegistryEntry): string | undefined {
  const keys = keyColumns(entry);
  const dateKeys = keys.filter((k) => entry.columns[k] === "date");
  if (dateKeys.length !== 1) return undefined;
  return dateKeys[0];
}

function journalRelPath(isoDay: string): string {
  const [y, m, d] = isoDay.split("-");
  return `user/journal/${y}/${m}/${d}.md`;
}

export function dayHasActivity(rootDir: string, isoDay: string): boolean {
  const log = join(rootDir, dailyLogRelPath(isoDay));
  const journal = join(rootDir, journalRelPath(isoDay));
  return existsSync(log) || existsSync(journal);
}

function readCsvDateValues(rootDir: string, entry: DataRegistryEntry, dateCol: string): Set<string> {
  const abs = join(rootDir, entry.path);
  if (!existsSync(abs)) return new Set();
  let rows: Record<string, string>[];
  try {
    rows = parse(readFileSync(abs, "utf8"), {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
    }) as Record<string, string>[];
  } catch {
    return new Set();
  }
  const dates = new Set<string>();
  for (const row of rows) {
    const v = String(row[dateCol] ?? "").trim();
    if (ISO_DAY.test(v)) dates.add(v);
  }
  return dates;
}

function daysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function computeConsolidationSeriesEntry(
  rootDir: string,
  entry: DataRegistryEntry,
  today: string,
): ConsolidationSeriesEntryResult {
  const dateCol = dateKeyColumn(entry);
  if (!dateCol) {
    return {
      ok: false,
      name: entry.name,
      path: entry.path,
      reason: "key must include exactly one date column to compute pending days",
    };
  }

  const present = readCsvDateValues(rootDir, entry, dateCol);
  const hasDataRows = present.size > 0;

  let scanStart: string;
  if (!hasDataRows) {
    scanStart = addDays(today, -(EMPTY_CSV_WINDOW_DAYS - 1));
  } else {
    const sorted = [...present].sort();
    scanStart = sorted[0]!;
  }

  const pending: string[] = [];
  for (const day of daysBetween(scanStart, today)) {
    if (!dayHasActivity(rootDir, day)) continue;
    if (present.has(day)) continue;
    pending.push(day);
  }

  pending.sort();
  const omitted = Math.max(0, pending.length - LIST_LIMIT);
  const listed = omitted > 0 ? pending.slice(-LIST_LIMIT) : pending;

  return {
    ok: true,
    name: entry.name,
    path: entry.path,
    inferred: entry.inferred,
    instructions: entry.instructions,
    pending: listed,
    omitted,
  };
}

export function formatConsolidationSeriesBlock(
  rootDir: string,
  entries: DataRegistryEntry[],
  today: string,
): string | undefined {
  const consolidation = entries.filter((e) => e.mode === "consolidation");
  if (consolidation.length === 0) return undefined;

  const lines = [
    "Registered series due for consolidation (write only listed days with data(action='append')):",
  ];

  for (const entry of consolidation) {
    const result = computeConsolidationSeriesEntry(rootDir, entry, today);
    if (!result.ok) {
      lines.push(`- ${result.name} (${result.path}): ${result.reason}`);
      continue;
    }
    lines.push(`- ${result.name} (${result.path}) inferred=${result.inferred}`);
    if (result.instructions?.trim()) {
      lines.push(`  instructions: ${result.instructions.trim().split(/\r?\n/)[0]}`);
    }
    if (result.pending.length === 0) {
      lines.push("  pending days: none");
    } else {
      lines.push(`  pending days: ${result.pending.join(", ")}`);
      if (result.omitted > 0) {
        lines.push(`  +${result.omitted} older days omitted`);
      }
      if (result.inferred) {
        lines.push(
          "  use origin: inferred and basis from that day's log or journal for each pending day",
        );
      }
    }
    lines.push("  do not append rows for days not listed above");
  }

  return lines.join("\n");
}
