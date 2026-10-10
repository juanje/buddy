// shared/dashboard/view-params.ts — View-specific validation (FR-DASH-10).

import type { SourceDefinition } from "./source-fields";
import type { WidgetSpec } from "./types";
import { validateInlineMetadata } from "./inline-source";

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

  return undefined;
}
