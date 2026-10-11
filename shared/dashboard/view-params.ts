// shared/dashboard/view-params.ts — View-specific validation (FR-DASH-10).

import type { SourceDefinition } from "./source-fields";
import type { WidgetSpec } from "./types";
import { validateInlineMetadata } from "./inline-source";
import { progressIsCountdown, V2_VIEWS } from "./views-v2-model";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function fieldNames(def: SourceDefinition): Set<string> {
  return new Set(Object.keys(def.fields));
}

function assertFieldsExist(names: string[], def: SourceDefinition, label: string): string | undefined {
  const known = fieldNames(def);
  for (const name of names) {
    if (!known.has(name)) {
      const available = [...known].sort().join(", ");
      return `Unknown field '${name}' in ${label}. Available fields: ${available}`;
    }
  }
  return undefined;
}

export function validateViewParams(
  spec: WidgetSpec,
  sourceDef: SourceDefinition | undefined,
): string | undefined {
  const raw = spec.raw;
  const view = spec.view;
  const source = spec.source;

  if (source === "inline") {
    const metaErr = validateInlineMetadata(raw);
    if (metaErr) return metaErr;
  }

  const allowsCountSum =
    view === "counter" ||
    view === "bar" ||
    (view === "progress" && raw.max !== undefined && !progressIsCountdown(raw));
  if (!allowsCountSum && (raw.count !== undefined || raw.sum !== undefined)) {
    return `'count' and 'sum' reduce rows to numbers, which only views 'counter', 'bar', and 'progress' (with max) render. Use view: counter (with 'group' for one number per group), or 'bar' / 'progress', or drop count/sum to show rows in '${view}'`;
  }

  if (raw.delta === true && typeof raw.range !== "string") {
    return "Counter delta requires a 'range' filter";
  }

  if (view === "kanban") {
    if (typeof raw.group !== "string") {
      return "Kanban view requires key 'group'";
    }
    if (raw.order !== undefined && !Array.isArray(raw.order)) {
      return "Kanban key 'order' must be a list of column values";
    }
    if (Array.isArray(raw.order) && raw.order.some((v) => typeof v !== "string")) {
      return "Kanban key 'order' must be a list of column values";
    }
    if (sourceDef) {
      const err = assertFieldsExist([raw.group], sourceDef, "group");
      if (err) return err;
      if (Array.isArray(raw.fields)) {
        const names = raw.fields.filter((f): f is string => typeof f === "string");
        const err2 = assertFieldsExist(names, sourceDef, "fields");
        if (err2) return err2;
      }
    }
  }

  if (view === "list" && Array.isArray(raw.fields) && sourceDef) {
    const names = raw.fields.filter((f): f is string => typeof f === "string");
    const err = assertFieldsExist(names, sourceDef, "fields");
    if (err) return err;
  }

  if (view === "table" && Array.isArray(raw.columns) && sourceDef) {
    const names = raw.columns.filter((c): c is string => typeof c === "string");
    if (names.length > 0) {
      const err = assertFieldsExist(names, sourceDef, "columns");
      if (err) return err;
    }
  }

  if (view === "counter") {
    const hasCount = raw.count === true;
    const hasSum = typeof raw.sum === "string";
    if (!hasCount && !hasSum) {
      return "Counter view requires 'count: true' or 'sum' with a field name";
    }
  }

  if (view === "bar") {
    if (typeof raw.group !== "string") return "Bar view requires key 'group'";
    const hasCount = raw.count === true;
    const hasSum = typeof raw.sum === "string";
    if (!hasCount && !hasSum) return "Bar view requires 'count: true' or 'sum' with a field name";
    if (sourceDef) {
      const err = assertFieldsExist([raw.group as string], sourceDef, "group");
      if (err) return err;
      if (hasSum) {
        const err2 = assertFieldsExist([raw.sum as string], sourceDef, "sum");
        if (err2) return err2;
      }
      if (typeof raw.stack === "string") {
        const err3 = assertFieldsExist([raw.stack], sourceDef, "stack");
        if (err3) return err3;
      }
    }
  }

  if (view === "line") {
    const x = raw.x;
    const y = raw.y;
    if (typeof x !== "string" || typeof y !== "string") return "Line view requires keys 'x' and 'y'";
    if (sourceDef) {
      const err = assertFieldsExist([x, y], sourceDef, "line");
      if (err) return err;
      if (typeof raw.series === "string") {
        const err2 = assertFieldsExist([raw.series], sourceDef, "series");
        if (err2) return err2;
      }
    }
  }

  if (view === "progress") {
    const countdown = progressIsCountdown(raw);
    const hasMax = raw.max !== undefined;
    if (countdown && hasMax) {
      return "Progress view cannot combine 'until' countdown with 'max' data mode";
    }
    if (countdown) {
      if (typeof raw.until !== "string" || !ISO_DAY.test(raw.until)) {
        return "Progress countdown requires 'until' as YYYY-MM-DD";
      }
      if (raw.since !== undefined && (typeof raw.since !== "string" || !ISO_DAY.test(raw.since))) {
        return "Progress key 'since' must be YYYY-MM-DD when set";
      }
      if (raw.count !== undefined || raw.sum !== undefined) {
        return "Progress countdown cannot use count or sum";
      }
    } else {
      if (typeof raw.max !== "number" || !Number.isFinite(raw.max) || raw.max <= 0) {
        return "Progress view requires numeric 'max' greater than zero, or 'until' for countdown";
      }
      const hasCount = raw.count === true;
      const hasSum = typeof raw.sum === "string";
      if (!hasCount && !hasSum) {
        return "Progress view requires 'count: true' or 'sum' with a field name";
      }
    }
  }

  if (view === "calendar") {
    if (typeof raw.date !== "string") return "Calendar view requires key 'date'";
    if (sourceDef) {
      const err = assertFieldsExist([raw.date as string], sourceDef, "date");
      if (err) return err;
      if (typeof raw.value === "string") {
        const err2 = assertFieldsExist([raw.value], sourceDef, "value");
        if (err2) return err2;
      }
    }
  }

  if (view === "timeline") {
    if (typeof raw.date !== "string" || typeof raw.label !== "string") {
      return "Timeline view requires keys 'date' and 'label'";
    }
    if (sourceDef) {
      const fields = [raw.date as string, raw.label as string];
      if (typeof raw.end === "string") fields.push(raw.end);
      const err = assertFieldsExist(fields, sourceDef, "timeline");
      if (err) return err;
    }
  }

  if (V2_VIEWS.has(view) && view !== "progress" && raw.delta === true) {
    return "Delta is only supported on view 'counter'";
  }

  return undefined;
}
