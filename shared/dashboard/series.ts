// shared/dashboard/series.ts — Series (CSV) primitive (FR-DASH-08).

import type { FieldType, SourceDefinition } from "./source-fields";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export class SeriesHeaderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeriesHeaderError";
  }
}

export function validateSeriesHeader(header: string[]): string | undefined {
  if (header.length === 0) return "CSV header is empty";
  const seen = new Set<string>();
  for (const name of header) {
    const trimmed = name.trim();
    if (!trimmed) return "CSV header has an empty column name";
    if (seen.has(trimmed)) return `Duplicate column '${trimmed}'`;
    seen.add(trimmed);
  }
  return undefined;
}

function hasLeadingZeroCode(value: string): boolean {
  return /^0\d/.test(value.trim());
}

function inferColumnType(values: string[]): FieldType {
  const nonEmpty = values.filter((v) => v.trim() !== "");
  if (nonEmpty.length === 0) return { kind: "string" };
  if (nonEmpty.some((v) => hasLeadingZeroCode(v))) return { kind: "string" };
  if (nonEmpty.every((v) => ISO_DAY.test(v))) return { kind: "date" };
  if (nonEmpty.every((v) => /^-?\d+(\.\d+)?$/.test(v))) return { kind: "number" };
  return { kind: "string" };
}

export function inferSeriesDefinition(
  header: string[],
  records: Record<string, string>[],
): SourceDefinition {
  const fields: Record<string, FieldType> = {};
  for (const col of header) {
    const values = records.map((r) => String(r[col] ?? ""));
    fields[col] = inferColumnType(values);
  }
  let dateField: string | undefined;
  if (fields.date?.kind === "date") {
    dateField = "date";
  } else {
    dateField = header.find((h) => fields[h]?.kind === "date");
  }
  return dateField ? { fields, dateField } : { fields };
}

export function castSeriesRows(
  records: Record<string, string>[],
  def: SourceDefinition,
): Record<string, unknown>[] {
  return records.map((record) => {
    const row: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(record)) {
      if (raw === undefined || raw === null || String(raw).trim() === "") continue;
      const ft = def.fields[key];
      if (ft?.kind === "number") {
        const n = Number(raw);
        if (!Number.isNaN(n)) row[key] = n;
      } else {
        row[key] = String(raw);
      }
    }
    return row;
  });
}
