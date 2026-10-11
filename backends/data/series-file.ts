// backends/data/series-file.ts — Validated CSV read/write for registered series (FR-DATA-03).

import { basename, dirname, join } from "node:path";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { parse, CsvError } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

import type { DataColumnType, DataRegistryEntry } from "../../shared/data/registry";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function declaredColumnOrder(entry: DataRegistryEntry): string[] {
  return Object.keys(entry.columns);
}

export function expectedCsvHeader(entry: DataRegistryEntry): string[] {
  const cols = declaredColumnOrder(entry);
  if (entry.inferred) return [...cols, "origin", "basis"];
  return cols;
}

function keyFieldNames(entry: DataRegistryEntry): string[] {
  return Array.isArray(entry.key) ? entry.key : [entry.key];
}

export function writeAtomic(rootDir: string, relPath: string, content: string): void {
  const abs = join(rootDir, relPath);
  const dir = dirname(abs);
  mkdirSync(dir, { recursive: true });
  const tmp = join(dir, `.${basename(abs)}.${process.pid}.${Date.now()}.tmp`);
  try {
    writeFileSync(tmp, content, "utf8");
    renameSync(tmp, abs);
  } catch (error) {
    try {
      rmSync(tmp, { force: true });
    } catch {
      // ignore
    }
    throw error;
  }
}

function validateFieldValue(type: DataColumnType, value: unknown, colName: string): string | null {
  if (value === undefined || value === null) {
    return `Missing value for column '${colName}'`;
  }
  const s = String(value).trim();
  if (type === "date") {
    if (!ISO_DAY.test(s)) return `Column '${colName}' must be a date (YYYY-MM-DD)`;
    return null;
  }
  if (type === "number") {
    if (s === "" || Number.isNaN(Number(s))) return `Column '${colName}' must be a number`;
    return null;
  }
  return null;
}

function normalizeStringField(value: unknown): string {
  return String(value).trim();
}

export function parseKeyMap(raw: unknown): Record<string, string> | string {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return "params.key must be a map of key column values";
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === undefined || v === null || String(v).trim() === "") {
      return `Key field '${k}' is required`;
    }
    out[k] = String(v).trim();
  }
  return out;
}

export function parseValuesMap(raw: unknown): Record<string, unknown> | string {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return "params.values must be a map of column values";
  }
  return raw as Record<string, unknown>;
}

function rowKeyId(row: Record<string, string>, keyFields: string[]): string {
  return keyFields.map((f) => row[f] ?? "").join("\0");
}

export type SeriesCsvState =
  | { ok: true; header: string[]; rows: Record<string, string>[] }
  | { ok: false; message: string };

export function readSeriesCsv(rootDir: string, relPath: string): SeriesCsvState {
  const abs = join(rootDir, relPath);
  if (!existsSync(abs)) {
    return { ok: true, header: [], rows: [] };
  }
  let text: string;
  try {
    text = readFileSync(abs, "utf8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
  if (text.trim() === "") {
    return { ok: true, header: [], rows: [] };
  }
  let header: string[] = [];
  try {
    const rows = parse(text, {
      columns: (cols: string[]) => {
        header = cols.map((c) => c.trim());
        return header;
      },
      bom: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: false,
    }) as Record<string, string>[];
    return { ok: true, header, rows };
  } catch (err) {
    if (err instanceof CsvError) {
      return { ok: false, message: err.message };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
}

function headerMismatch(expected: string[], actual: string[]): string | null {
  if (actual.length === 0) return null;
  if (expected.length !== actual.length) {
    return `CSV header column count differs (expected ${expected.length}, got ${actual.length})`;
  }
  for (let i = 0; i < expected.length; i++) {
    if (expected[i] !== actual[i]) {
      return `CSV header mismatch at column ${i + 1}: expected '${expected[i]}', got '${actual[i] ?? ""}'`;
    }
  }
  return null;
}

function serializeCsv(header: string[], rows: Record<string, string>[]): string {
  return stringify(rows, { header: true, columns: header });
}

function validateRowAgainstSchema(
  entry: DataRegistryEntry,
  values: Record<string, unknown>,
  options: { allowOriginBasis: boolean },
): Record<string, string> | string {
  const keyFields = keyFieldNames(entry);
  for (const k of keyFields) {
    if (!(k in values)) {
      return `Missing key field '${k}' in values`;
    }
  }

  const order = declaredColumnOrder(entry);
  const row: Record<string, string> = {};

  for (const col of order) {
    if (!(col in values)) {
      return `Missing value for column '${col}'`;
    }
    const err = validateFieldValue(entry.columns[col], values[col], col);
    if (err) return err;
    const raw = values[col];
    row[col] =
      entry.columns[col] === "number" ? String(Number(String(raw).trim())) : normalizeStringField(raw);
  }

  for (const col of Object.keys(values)) {
    if (order.includes(col)) continue;
    if (options.allowOriginBasis && (col === "origin" || col === "basis")) continue;
    if (!entry.inferred && (col === "origin" || col === "basis")) {
      return `Column '${col}' is not allowed for this entry`;
    }
    return `Unexpected column '${col}' in values`;
  }

  return row;
}

export function appendSeriesRow(
  rootDir: string,
  entry: DataRegistryEntry,
  values: Record<string, unknown>,
): { ok: true } | { ok: false; message: string } {
  const validated = validateRowAgainstSchema(entry, values, { allowOriginBasis: entry.inferred });
  if (typeof validated === "string") return { ok: false, message: validated };

  const keyFields = keyFieldNames(entry);
  const expectedHeader = expectedCsvHeader(entry);
  const state = readSeriesCsv(rootDir, entry.path);
  if (!state.ok) return { ok: false, message: state.message };

  const mismatch = headerMismatch(expectedHeader, state.header);
  if (mismatch) return { ok: false, message: mismatch };

  const newKey = rowKeyId(validated, keyFields);
  for (const existing of state.rows) {
    if (rowKeyId(existing, keyFields) === newKey) {
      return { ok: false, message: "A row with this key already exists" };
    }
  }

  const header = state.header.length > 0 ? state.header : expectedHeader;
  const nextRows = [...state.rows, validated];
  writeAtomic(rootDir, entry.path, serializeCsv(header, nextRows));
  return { ok: true };
}

export function correctSeriesRow(
  rootDir: string,
  entry: DataRegistryEntry,
  key: Record<string, string>,
  options: { remove?: boolean; set?: Record<string, unknown> },
): { ok: true; changed: boolean } | { ok: false; message: string } {
  const keyFields = keyFieldNames(entry);
  for (const f of keyFields) {
    if (!(f in key)) return { ok: false, message: `Key field '${f}' is required in params.key` };
    const err = validateFieldValue(entry.columns[f], key[f], f);
    if (err) return { ok: false, message: err };
  }

  const expectedHeader = expectedCsvHeader(entry);
  const state = readSeriesCsv(rootDir, entry.path);
  if (!state.ok) return { ok: false, message: state.message };
  if (state.header.length === 0 && state.rows.length === 0) {
    return { ok: true, changed: false };
  }

  const mismatch = headerMismatch(expectedHeader, state.header);
  if (mismatch) return { ok: false, message: mismatch };

  const targetKey = rowKeyId(
    Object.fromEntries(keyFields.map((f) => [f, normalizeStringField(key[f])])),
    keyFields,
  );

  const idx = state.rows.findIndex((r) => rowKeyId(r, keyFields) === targetKey);
  if (idx < 0) return { ok: true, changed: false };

  if (options.remove) {
    const nextRows = state.rows.filter((_, i) => i !== idx);
    writeAtomic(rootDir, entry.path, serializeCsv(state.header, nextRows));
    return { ok: true, changed: true };
  }

  const set = options.set;
  if (!set || typeof set !== "object" || Array.isArray(set)) {
    return { ok: false, message: "correct requires params.set unless remove is true" };
  }

  for (const f of keyFields) {
    if (f in set) {
      return { ok: false, message: `Cannot change key field '${f}' with correct; remove and append instead` };
    }
  }

  const merged: Record<string, unknown> = { ...state.rows[idx] };
  for (const [col, val] of Object.entries(set)) {
    if (!(col in entry.columns)) {
      return { ok: false, message: `Unknown column '${col}' in params.set` };
    }
    merged[col] = val;
  }

  const validated = validateRowAgainstSchema(entry, merged, { allowOriginBasis: entry.inferred });
  if (typeof validated === "string") return { ok: false, message: validated };

  const nextRows = [...state.rows];
  nextRows[idx] = validated;
  writeAtomic(rootDir, entry.path, serializeCsv(state.header, nextRows));
  return { ok: true, changed: true };
}
