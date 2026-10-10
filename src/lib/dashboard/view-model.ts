// src/lib/dashboard/view-model.ts — Dashboard layout and view shaping (FR-DASH-10, FR-DASH-03).

import type { AppLocale } from "../i18n";
import { humanizeFieldLabel, overdueLabel } from "./field-labels";
import type {
  ResolvedDashboard,
  ResolvedWidgetSegment,
  WidgetProvenance,
  WidgetResult,
  WidgetSpec,
  WidgetWidth,
} from "../../../shared/dashboard/types";

export type StatusTone = "ok" | "warn" | "bad" | "unknown";

export type DashboardRow =
  | { kind: "text"; markdown: string }
  | { kind: "widgetRow"; widgets: DashboardWidgetVm[] };

export type DashboardWidgetVm =
  | { kind: "error"; key: string; title: string; message: string; width: WidgetWidth; provenance?: WidgetProvenance }
  | { kind: "kanban"; key: string; title: string; width: WidgetWidth; columns: KanbanColumnVm[]; empty: boolean; provenance?: WidgetProvenance }
  | { kind: "list"; key: string; title: string; width: WidgetWidth; items: ListItemVm[]; empty: boolean; provenance?: WidgetProvenance }
  | {
      kind: "table";
      key: string;
      title: string;
      width: WidgetWidth;
      headers: TableHeaderVm[];
      rows: Record<string, string>[];
      empty: boolean;
      provenance?: WidgetProvenance;
    }
  | {
      kind: "counter";
      key: string;
      title: string;
      width: WidgetWidth;
      value?: number;
      delta?: number;
      groups?: CounterGroupVm[];
      empty: boolean;
      provenance?: WidgetProvenance;
    }
  | { kind: "textWidget"; key: string; title: string; width: WidgetWidth; markdown: string; provenance?: WidgetProvenance; inlineStyle: boolean }
  | { kind: "status"; key: string; title: string; width: WidgetWidth; cards: StatusCardVm[]; empty: boolean; provenance?: WidgetProvenance };

export type TableHeaderVm = { key: string; label: string };
export type CounterGroupVm = { label: string; value: number };
export type KanbanColumnVm = { key: string | null; label: string; cards: KanbanCardVm[] };
export type KanbanCardVm = { text: string; chips: string[]; overdueDays?: number };
export type ListItemVm = { primary: string; fields: string[]; overdueDays?: number };
export type StatusCardVm = { label: string; state: StatusTone; reason: string };

export type DashboardViewModel = {
  rows: DashboardRow[];
};

const TASK_STATE_ORDER = ["next", "open", "scheduled", "parked"] as const;

const TASK_STATE_LABELS: Record<AppLocale, Record<string, string>> = {
  en: {
    next: "Next",
    open: "Open",
    scheduled: "Scheduled",
    parked: "Parked",
  },
  es: {
    next: "Siguiente",
    open: "Abierta",
    scheduled: "Programada",
    parked: "Aparcada",
  },
};

export function nullGroupLabel(locale: AppLocale): string {
  return locale === "es" ? "(sin valor)" : "(no value)";
}

export function taskStateLabel(state: string, locale: AppLocale): string {
  return TASK_STATE_LABELS[locale][state] ?? state;
}

export function statusTone(raw: unknown): StatusTone {
  const s = String(raw ?? "unknown").toLowerCase();
  if (s === "ok" || s === "warn" || s === "bad" || s === "unknown") return s;
  return "unknown";
}

export function formatAgeDays(ageDays: number, locale: AppLocale): string {
  if (ageDays <= 0) {
    return locale === "es" ? "actualizado hoy" : "updated today";
  }
  if (ageDays === 1) {
    return locale === "es" ? "actualizado hace 1 día" : "updated 1 day ago";
  }
  return locale === "es"
    ? `actualizado hace ${ageDays} días`
    : `updated ${ageDays} days ago`;
}

function widgetTitle(spec: WidgetSpec): string {
  return spec.title ?? spec.view;
}

function humanizeColumnKey(key: string): string {
  const spaced = key.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function columnLabel(
  key: string | null,
  groupField: string | undefined,
  locale: AppLocale,
): string {
  if (key === null) return nullGroupLabel(locale);
  if (groupField === "state" && specIsTasksState(key)) {
    return taskStateLabel(key, locale);
  }
  return humanizeColumnKey(key);
}

function specIsTasksState(key: string): boolean {
  return (TASK_STATE_ORDER as readonly string[]).includes(key);
}

function tableColumns(spec: WidgetSpec, sample?: Record<string, unknown>): string[] {
  const raw = spec.raw.columns;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.filter((c): c is string => typeof c === "string");
  }
  if (sample) return Object.keys(sample);
  return [];
}

function listFields(spec: WidgetSpec): string[] {
  const raw = spec.raw.fields;
  if (Array.isArray(raw)) {
    return raw.filter((f): f is string => typeof f === "string");
  }
  return [];
}

function cellText(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  return String(value);
}

function overdueFromRow(row: Record<string, unknown>): number | undefined {
  const v = row.overdue_days;
  return typeof v === "number" && v > 0 ? v : undefined;
}

function buildWidgetVm(
  seg: ResolvedWidgetSegment,
  locale: AppLocale,
  widgetKey: string,
): DashboardWidgetVm {
  const { spec, result, provenance } = seg;
  const title = widgetTitle(spec);
  const width = spec.width ?? "full";

  if (result.kind === "error") {
    return { kind: "error", key: widgetKey, title, message: result.message, width, provenance };
  }

  switch (spec.view) {
    case "kanban":
      return buildKanban(widgetKey, title, width, spec, result, locale, provenance);
    case "list":
      return buildList(widgetKey, title, width, spec, result, provenance);
    case "table":
      return buildTable(widgetKey, title, width, spec, result, locale, provenance);
    case "counter":
      return buildCounter(widgetKey, title, width, spec, result, locale, provenance);
    case "text":
      return {
        kind: "textWidget",
        key: widgetKey,
        title,
        width,
        markdown: result.kind === "text" ? result.text : "",
        provenance,
        inlineStyle: Boolean(provenance),
      };
    case "status":
      return buildStatus(widgetKey, title, width, result, provenance);
    default:
      return {
        kind: "error",
        key: widgetKey,
        title,
        message: `Unsupported view '${spec.view}'`,
        width,
        provenance,
      };
  }
}

function groupKeyToken(key: string | null): string {
  return key === null ? "null" : key;
}

function kanbanColumnOrder(
  spec: WidgetSpec,
  groupField: string | undefined,
  groups: Array<{ key: string | null; rows: Record<string, unknown>[] }>,
): Array<string | null> {
  const orderRaw = spec.raw.order;
  const explicitOrder = Array.isArray(orderRaw)
    ? orderRaw.filter((v): v is string => typeof v === "string")
    : undefined;

  if (explicitOrder && explicitOrder.length > 0) {
    const byKey = new Map(groups.map((g) => [groupKeyToken(g.key), g.key]));
    const keys: Array<string | null> = [];
    const seen = new Set<string>();
    for (const name of explicitOrder) {
      keys.push(byKey.get(name) ?? name);
      seen.add(name);
    }
    const rest = groups
      .map((g) => g.key)
      .filter((k) => !seen.has(groupKeyToken(k)))
      .sort((a, b) => groupKeyToken(a).localeCompare(groupKeyToken(b)));
    return [...keys, ...rest];
  }

  if (groupField === "state" && spec.source === "tasks") {
    return [...TASK_STATE_ORDER];
  }
  return groups.map((g) => g.key);
}

function buildKanban(
  key: string,
  title: string,
  width: WidgetWidth,
  spec: WidgetSpec,
  result: WidgetResult,
  locale: AppLocale,
  provenance?: WidgetProvenance,
): DashboardWidgetVm {
  const groupField = typeof spec.raw.group === "string" ? spec.raw.group : undefined;
  const fieldList = listFields(spec);
  const columns: KanbanColumnVm[] = [];

  if (result.kind === "groups") {
    const order = kanbanColumnOrder(spec, groupField, result.groups);
    for (const colKey of order) {
      const group = result.groups.find((g) => g.key === colKey);
      const rows = group?.rows ?? [];
      columns.push({
        key: colKey ?? null,
        label: columnLabel(colKey ?? null, groupField, locale),
        cards: rows.map((row) => ({
          text: cellText(row.text),
          chips: fieldList
            .filter((f) => f !== "text" && f !== "overdue_days")
            .map((f) => cellText(row[f]))
            .filter(Boolean),
          overdueDays: overdueFromRow(row),
        })),
      });
    }
  }

  const empty = columns.every((c) => c.cards.length === 0);
  return { kind: "kanban", key, title, width, columns, empty, provenance };
}

function buildList(
  key: string,
  title: string,
  width: WidgetWidth,
  spec: WidgetSpec,
  result: WidgetResult,
  provenance?: WidgetProvenance,
): DashboardWidgetVm {
  const fields = listFields(spec).filter((f) => f !== "overdue_days");
  const items: ListItemVm[] =
    result.kind === "rows"
      ? result.rows.map((row) => ({
          primary: cellText(row.text ?? row.label ?? Object.values(row)[0]),
          fields: fields.map((f) => cellText(row[f])).filter(Boolean),
          overdueDays: overdueFromRow(row),
        }))
      : [];
  return { kind: "list", key, title, width, items, empty: items.length === 0, provenance };
}

function buildTable(
  key: string,
  title: string,
  width: WidgetWidth,
  spec: WidgetSpec,
  result: WidgetResult,
  locale: AppLocale,
  provenance?: WidgetProvenance,
): DashboardWidgetVm {
  const sample = result.kind === "rows" && result.rows[0] ? result.rows[0] : undefined;
  const columns = tableColumns(spec, sample);
  const headers: TableHeaderVm[] = columns.map((col) => ({
    key: col,
    label: humanizeFieldLabel(col, spec.source, locale),
  }));
  const rows =
    result.kind === "rows"
      ? result.rows.map((row) => {
          const out: Record<string, string> = {};
          for (const col of columns) {
            out[col] = cellText(row[col]);
          }
          return out;
        })
      : [];
  return { kind: "table", key, title, width, headers, rows, empty: rows.length === 0, provenance };
}

function buildCounter(
  key: string,
  title: string,
  width: WidgetWidth,
  spec: WidgetSpec,
  result: WidgetResult,
  locale: AppLocale,
  provenance?: WidgetProvenance,
): DashboardWidgetVm {
  const groupField = typeof spec.raw.group === "string" ? spec.raw.group : undefined;

  if (result.kind === "group_values") {
    const groups: CounterGroupVm[] = result.groups.map((g) => ({
      label: columnLabel(g.key, groupField, locale),
      value: g.value,
    }));
    return {
      kind: "counter",
      key,
      title,
      width,
      groups,
      empty: groups.every((g) => g.value === 0),
      provenance,
    };
  }

  if (result.kind === "value") {
    return {
      kind: "counter",
      key,
      title,
      width,
      value: result.value,
      delta: result.delta,
      empty: false,
      provenance,
    };
  }
  return { kind: "counter", key, title, width, empty: true, provenance };
}

function buildStatus(
  key: string,
  title: string,
  width: WidgetWidth,
  result: WidgetResult,
  provenance?: WidgetProvenance,
): DashboardWidgetVm {
  const cards: StatusCardVm[] =
    result.kind === "rows"
      ? result.rows.map((row) => ({
          label: cellText(row.label),
          state: statusTone(row.state),
          reason: cellText(row.reason),
        }))
      : [];
  return { kind: "status", key, title, width, cards, empty: cards.length === 0, provenance };
}

/** Collect stable widget keys from a built view model (FR-DASH-10). */
export function widgetKeysFromViewModel(vm: DashboardViewModel): string[] {
  const keys: string[] = [];
  for (const row of vm.rows) {
    if (row.kind === "widgetRow") {
      for (const w of row.widgets) {
        keys.push(w.key);
      }
    }
  }
  return keys;
}

export { overdueLabel };

function widthFraction(width: WidgetWidth): number {
  if (width === "half") return 0.5;
  if (width === "third") return 1 / 3;
  return 1;
}

/** Lay out consecutive half/third widgets on shared rows (FR-DASH-01). */
export function layoutWidgetRows(widgets: DashboardWidgetVm[]): DashboardWidgetVm[][] {
  const rows: DashboardWidgetVm[][] = [];
  let current: DashboardWidgetVm[] = [];
  let used = 0;

  for (const widget of widgets) {
    const frac = widthFraction(widget.width ?? "full");
    if (frac >= 1) {
      if (current.length > 0) {
        rows.push(current);
        current = [];
        used = 0;
      }
      rows.push([widget]);
      continue;
    }
    if (used + frac > 1.001) {
      rows.push(current);
      current = [];
      used = 0;
    }
    current.push(widget);
    used += frac;
  }
  if (current.length > 0) rows.push(current);
  return rows;
}

export function buildDashboardViewModel(
  model: ResolvedDashboard,
  locale: AppLocale,
  _emptyLabel: string,
): DashboardViewModel {
  const rows: DashboardRow[] = [];
  let widgetBuffer: DashboardWidgetVm[] = [];
  let widgetIndex = 0;

  const flushWidgets = () => {
    if (widgetBuffer.length === 0) return;
    for (const row of layoutWidgetRows(widgetBuffer)) {
      rows.push({ kind: "widgetRow", widgets: row });
    }
    widgetBuffer = [];
  };

  for (const segment of model.segments) {
    if (segment.kind === "text") {
      flushWidgets();
      rows.push({ kind: "text", markdown: segment.markdown });
      continue;
    }
    widgetBuffer.push(buildWidgetVm(segment, locale, `w-${widgetIndex++}`));
  }
  flushWidgets();

  return { rows };
}

export function segmentCount(model: ResolvedDashboard): number {
  return model.segments.length;
}
