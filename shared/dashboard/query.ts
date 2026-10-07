// shared/dashboard/query.ts — Widget query engine (FR-DASH-04, FR-DASH-10).

import type { FieldType, SourceDefinition } from "./source-fields";
import { coerceIsoDay, parseRelativeDateBound } from "./query-dates";
import { parseDateRange, previousPeriodOfSameLength } from "./range";
import type { WidgetResult, WidgetSpec } from "./types";

export type QueryOutcome =
  | { ok: true; result: WidgetResult }
  | { ok: false; message: string };

export { addMonths } from "./query-dates";

type Clause = { field: string; op: string; value: string };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function normalizeCompareValue(raw: string): string {
  let v = raw.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  if (v.startsWith("@") || v.startsWith("#")) v = v.slice(1);
  return v;
}

function splitWhereClauses(where: string): Clause[] {
  const parts = where.split(/\s+and\s+/i).map((p) => p.trim()).filter(Boolean);
  const clauses: Clause[] = [];
  for (const part of parts) {
    const match =
      /^(\w+)\s*(=|!=|<=|>=|<|>|contains)\s*(.*)$/i.exec(part) ??
      /^(\w+)\s*(=|!=|<=|>=|<|>)\s*$/i.exec(part);
    if (!match) {
      throw new Error(`Cannot parse where clause '${part}'`);
    }
    const value = (match[3] ?? "").trim();
    if (value === "" && (match[2] === "=" || match[2] === "!=")) {
      throw new Error(
        "Filter value is empty. Quote values that start with # or @ (for example where: 'project = #buddy').",
      );
    }
    clauses.push({ field: match[1], op: match[2].toLowerCase(), value });
  }
  return clauses;
}

function fieldType(def: SourceDefinition, field: string): FieldType | undefined {
  return def.fields[field];
}

function assertField(def: SourceDefinition, field: string): QueryOutcome | undefined {
  if (!fieldType(def, field)) {
    const names = Object.keys(def.fields).sort().join(", ");
    return { ok: false, message: `Unknown field '${field}'. Available fields: ${names}` };
  }
  return undefined;
}

function compareClause(
  row: Record<string, unknown>,
  clause: Clause,
  def: SourceDefinition,
  today: string,
): boolean {
  const fType = fieldType(def, clause.field)!;
  const raw = row[clause.field];
  const rhs = normalizeCompareValue(clause.value);

  if (fType.kind === "date") {
    const left = coerceIsoDay(raw, today);
    const right =
      parseRelativeDateBound(clause.value, today) ?? (ISO_DAY.test(rhs) ? rhs : undefined);
    if (!left || !right) {
      if (clause.op === "!=") return true;
      return false;
    }
    switch (clause.op) {
      case "=":
        return left === right;
      case "!=":
        return left !== right;
      case "<":
        return left < right;
      case "<=":
        return left <= right;
      case ">":
        return left > right;
      case ">=":
        return left >= right;
      default:
        return false;
    }
  }

  const left = raw === undefined || raw === null ? "" : String(raw);
  if (clause.op === "contains") {
    return left.toLowerCase().includes(rhs.toLowerCase());
  }
  switch (clause.op) {
    case "=":
      return left === rhs;
    case "!=":
      return left !== rhs;
    default:
      return false;
  }
}

function applyRangeBounds(
  rows: Record<string, unknown>[],
  start: string,
  end: string,
  def: SourceDefinition,
  today: string,
): Record<string, unknown>[] | QueryOutcome {
  const dateField = def.dateField;
  if (!dateField) {
    return { ok: false, message: `Source has no date field for range filter` };
  }
  const err = assertField(def, dateField);
  if (err) return err;
  return rows.filter((row) => {
    const d = coerceIsoDay(row[dateField], today);
    if (!d) return false;
    return d >= start && d <= end;
  });
}

function applyRange(
  rows: Record<string, unknown>[],
  range: string,
  def: SourceDefinition,
  today: string,
): Record<string, unknown>[] | QueryOutcome {
  const parsed = parseDateRange(range, today);
  if (!parsed) {
    return { ok: false, message: `Cannot parse range '${range}'` };
  }
  return applyRangeBounds(rows, parsed.start, parsed.end, def, today);
}

function applySort(
  rows: Record<string, unknown>[],
  sort: string,
  def: SourceDefinition,
): Record<string, unknown>[] | QueryOutcome {
  const parts = sort.trim().split(/\s+/);
  const field = parts[0];
  const dir = (parts[1] ?? "asc").toLowerCase();
  const err = assertField(def, field);
  if (err) return err;
  const copy = [...rows];
  copy.sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    const aMissing = av === undefined || av === null || av === "";
    const bMissing = bv === undefined || bv === null || bv === "";
    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;
    const cmp = String(av).localeCompare(String(bv));
    return dir === "desc" ? -cmp : cmp;
  });
  return copy;
}

function groupKeysInOrder(field: string, def: SourceDefinition, rows: Record<string, unknown>[]): string[] {
  const fType = fieldType(def, field);
  if (fType?.kind === "enum") {
    return [...fType.values];
  }
  const keys = new Set<string>();
  for (const row of rows) {
    const v = row[field];
    keys.add(v === undefined || v === null || v === "" ? "null" : String(v));
  }
  return [...keys].sort();
}

function rangeStringFromBounds(start: string, end: string): string {
  return `${start}..${end}`;
}

function filterWorkingSet(
  initialRows: Record<string, unknown>[],
  spec: WidgetSpec,
  sourceDef: SourceDefinition,
  today: string,
  rangeOverride?: string,
): Record<string, unknown>[] | QueryOutcome {
  let working = [...initialRows];
  const raw = spec.raw;
  const range =
    rangeOverride ?? (typeof raw.range === "string" ? raw.range : undefined);
  if (range) {
    const ranged = applyRange(working, range, sourceDef, today);
    if (!Array.isArray(ranged)) return ranged;
    working = ranged;
  }

  const where = typeof raw.where === "string" ? raw.where : undefined;
  if (where) {
    let clauses: Clause[];
    try {
      clauses = splitWhereClauses(where);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, message };
    }
    for (const clause of clauses) {
      const err = assertField(sourceDef, clause.field);
      if (err) return err;
    }
    working = working.filter((row) =>
      clauses.every((c) => compareClause(row, c, sourceDef, today)),
    );
  }

  const sort = typeof raw.sort === "string" ? raw.sort : undefined;
  if (sort) {
    const sorted = applySort(working, sort, sourceDef);
    if (!Array.isArray(sorted)) return sorted;
    working = sorted;
  }

  const limit = typeof raw.limit === "number" ? raw.limit : undefined;
  if (limit !== undefined && limit > 0) {
    working = working.slice(0, limit);
  }

  return working;
}

function aggregateValue(
  working: Record<string, unknown>[],
  spec: WidgetSpec,
  sourceDef: SourceDefinition,
): QueryOutcome {
  const raw = spec.raw;
  const group = typeof raw.group === "string" ? raw.group : undefined;
  const count = raw.count === true;
  const sumField = typeof raw.sum === "string" ? raw.sum : undefined;

  if (sumField) {
    const err = assertField(sourceDef, sumField);
    if (err) return err;
    const fType = fieldType(sourceDef, sumField)!;
    if (fType.kind !== "number") {
      return { ok: false, message: `Field '${sumField}' is not numeric` };
    }
    let total = 0;
    for (const row of working) {
      const v = row[sumField];
      if (typeof v === "number") total += v;
    }
    return { ok: true, result: { kind: "value", value: total } };
  }

  if (count && group) {
    const err = assertField(sourceDef, group);
    if (err) return err;
    const keys = groupKeysInOrder(group, sourceDef, working);
    const groups = keys.map((key) => {
      const rowsInGroup = working.filter((row) => {
        const v = row[group];
        const k = v === undefined || v === null || v === "" ? "null" : String(v);
        return k === key;
      });
      return { key: key === "null" ? null : key, value: rowsInGroup.length };
    });
    return { ok: true, result: { kind: "group_values", groups } };
  }

  if (count) {
    return { ok: true, result: { kind: "value", value: working.length } };
  }

  if (group) {
    const err = assertField(sourceDef, group);
    if (err) return err;
    const keys = groupKeysInOrder(group, sourceDef, working);
    const groups = keys.map((key) => ({
      key: key === "null" ? null : key,
      rows: working.filter((row) => {
        const v = row[group];
        const k = v === undefined || v === null || v === "" ? "null" : String(v);
        return k === key;
      }),
    }));
    return { ok: true, result: { kind: "groups", groups } };
  }

  return { ok: true, result: { kind: "rows", rows: working } };
}

export function applyWidgetQuery(
  rows: Record<string, unknown>[],
  spec: WidgetSpec,
  _sourceName: string,
  sourceDef: SourceDefinition,
  today: string,
): QueryOutcome {
  const raw = spec.raw;
  const wantDelta = raw.delta === true;
  const range = typeof raw.range === "string" ? raw.range : undefined;

  const working = filterWorkingSet(rows, spec, sourceDef, today);
  if (!Array.isArray(working)) return working;

  const outcome = aggregateValue(working, spec, sourceDef);
  if (!outcome.ok || !wantDelta || !range) {
    return outcome;
  }

  if (outcome.result.kind !== "value") {
    return outcome;
  }

  const parsed = parseDateRange(range, today);
  if (!parsed) {
    return { ok: false, message: `Cannot parse range '${range}'` };
  }
  const prev = previousPeriodOfSameLength(parsed);
  const prevRange = rangeStringFromBounds(prev.start, prev.end);
  const prevWorking = filterWorkingSet(rows, spec, sourceDef, today, prevRange);
  if (!Array.isArray(prevWorking)) return prevWorking;
  const prevOutcome = aggregateValue(prevWorking, spec, sourceDef);
  if (!prevOutcome.ok || prevOutcome.result.kind !== "value") {
    return outcome;
  }

  return {
    ok: true,
    result: {
      kind: "value",
      value: outcome.result.value,
      delta: outcome.result.value - prevOutcome.result.value,
    },
  };
}
