// shared/dashboard/source-fields.ts — Source catalog for validation (FR-DASH-05+).

export type FieldType =
  | { kind: "string" }
  | { kind: "number" }
  | { kind: "date" }
  | { kind: "enum"; values: readonly string[] };

export type SourceDefinition = {
  dateField?: string;
  fields: Record<string, FieldType>;
};

/** Built-in source names known to the dashboard engine. */
export const BUILTIN_SOURCE_NAMES = ["tasks", "deferred", "projects", "logs", "journal"] as const;

export const TASKS_SOURCE: SourceDefinition = {
  dateField: "due",
  fields: {
    text: { kind: "string" },
    area: { kind: "string" },
    project: { kind: "string" },
    due: { kind: "date" },
    created: { kind: "date" },
    state: {
      kind: "enum",
      values: ["next", "open", "scheduled", "parked"],
    },
    stale_days: { kind: "number" },
    overdue_days: { kind: "number" },
  },
};

export const DEFERRED_SOURCE: SourceDefinition = {
  dateField: "date",
  fields: {
    type: { kind: "string" },
    date: { kind: "date" },
    source: { kind: "string" },
    text: { kind: "string" },
  },
};

export function sourceDefinition(name: string): SourceDefinition | undefined {
  if (name === "tasks") return TASKS_SOURCE;
  if (name === "deferred") return DEFERRED_SOURCE;
  return undefined;
}

export function listKnownSourceNames(): string[] {
  return [...BUILTIN_SOURCE_NAMES];
}
