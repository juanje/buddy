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
export const BUILTIN_SOURCE_NAMES = ["tasks", "deferred", "projects", "logs", "journal", "wip"] as const;

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

export const PROJECTS_SOURCE: SourceDefinition = {
  fields: {
    name: { kind: "string" },
    summary: { kind: "string" },
    open_tasks: { kind: "number" },
    next_action: { kind: "string" },
  },
};

export const LOGS_SOURCE: SourceDefinition = {
  dateField: "date",
  fields: {
    date: { kind: "date" },
    status: { kind: "string" },
    summary: { kind: "string" },
  },
};

export const JOURNAL_SOURCE: SourceDefinition = {
  dateField: "date",
  fields: {
    date: { kind: "date" },
  },
};

/** Active fronts per area against the WIP limit (FR-DASH-20). Shaped for `status` too. */
export const WIP_SOURCE: SourceDefinition = {
  fields: {
    area: { kind: "string" },
    fronts: { kind: "number" },
    limit: { kind: "number" },
    over_by: { kind: "number" },
    label: { kind: "string" },
    state: { kind: "enum", values: ["ok", "bad"] },
    reason: { kind: "string" },
  },
};

export function sourceDefinition(name: string): SourceDefinition | undefined {
  if (name === "wip") return WIP_SOURCE;
  if (name === "tasks") return TASKS_SOURCE;
  if (name === "deferred") return DEFERRED_SOURCE;
  if (name === "projects") return PROJECTS_SOURCE;
  if (name === "logs") return LOGS_SOURCE;
  if (name === "journal") return JOURNAL_SOURCE;
  return undefined;
}

export function listKnownSourceNames(): string[] {
  return [...BUILTIN_SOURCE_NAMES];
}
