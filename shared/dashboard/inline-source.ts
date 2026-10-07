// shared/dashboard/inline-source.ts — Inline widget rows (FR-DASH-09).

import type { FieldType, SourceDefinition } from "./source-fields";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function parseInlineRows(raw: Record<string, unknown>): Record<string, unknown>[] | string {
  const rows = raw.rows;
  if (rows === undefined) return [];
  if (!Array.isArray(rows)) {
    return "Inline source requires 'rows' to be a list";
  }
  const out: Record<string, unknown>[] = [];
  for (const item of rows) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      return "Each inline row must be a map";
    }
    out.push(item as Record<string, unknown>);
  }
  return out;
}

export function validateInlineMetadata(raw: Record<string, unknown>): string | undefined {
  const updated = raw.updated;
  if (typeof updated !== "string" || !ISO_DAY.test(updated)) {
    return "Inline source requires 'updated' as an ISO date (YYYY-MM-DD)";
  }
  const basis = raw.basis;
  if (typeof basis !== "string" || basis.trim() === "") {
    return "Inline source requires 'basis' (one line describing the source)";
  }
  return undefined;
}

export function ageDaysFromUpdated(updated: string, today: string): number {
  const len = daysBetween(updated, today);
  return len < 0 ? 0 : len;
}

function daysBetween(start: string, end: string): number {
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ye, me, de] = end.split("-").map(Number);
  const a = Date.UTC(ys, ms - 1, ds);
  const b = Date.UTC(ye, me - 1, de);
  return Math.round((b - a) / 86_400_000);
}

export function inferInlineSourceDefinition(rows: Record<string, unknown>[]): SourceDefinition {
  const fields: Record<string, FieldType> = {};
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (fields[key]) continue;
      fields[key] = inferFieldType(value);
    }
  }
  return { fields };
}

function inferFieldType(value: unknown): FieldType {
  if (typeof value === "number" && Number.isFinite(value)) return { kind: "number" };
  if (typeof value === "string" && ISO_DAY.test(value)) return { kind: "date" };
  return { kind: "string" };
}
