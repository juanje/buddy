// src/lib/dashboard/view-model.ts — Dashboard layout and view shaping (FR-DASH-10, FR-DASH-03).

import type { AppLocale } from "../i18n";
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
  | { kind: "error"; title: string; message: string; width: WidgetWidth; provenance?: WidgetProvenance }
  | { kind: "kanban"; title: string; width: WidgetWidth; columns: KanbanColumnVm[]; empty: boolean; provenance?: WidgetProvenance }
  | { kind: "list"; title: string; width: WidgetWidth; items: ListItemVm[]; empty: boolean; provenance?: WidgetProvenance }
  | { kind: "table"; title: string; width: WidgetWidth; columns: string[]; rows: Record<string, string>[]; empty: boolean; provenance?: WidgetProvenance }
  | { kind: "counter"; title: string; width: WidgetWidth; value: number; delta?: number; empty: boolean; provenance?: WidgetProvenance }
  | { kind: "textWidget"; title: string; width: WidgetWidth; markdown: string; provenance?: WidgetProvenance; inlineStyle: boolean }
  | { kind: "status"; title: string; width: WidgetWidth; cards: StatusCardVm[]; empty: boolean; provenance?: WidgetProvenance };

export type KanbanColumnVm = { key: string | null; label: string; cards: KanbanCardVm[] };
export type KanbanCardVm = { text: string; chips: string[] };
export type ListItemVm = { primary: string; fields: string[] };
export type StatusCardVm = { label: string; state: StatusTone; reason: string };

export type DashboardViewModel = {
  title?: string;
  summary?: string;
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

function columnLabel(
  key: string | null,
  groupField: string | undefined,
  locale: AppLocale,
): string {
  if (key === null) return nullGroupLabel(locale);
  if (groupField === "state" && specIsTasksState(key)) {
    return taskStateLabel(key, locale);
  }
  return key;
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

function buildWidgetVm(
  seg: ResolvedWidgetSegment,
  locale: AppLocale,
  _emptyLabel: string,
): DashboardWidgetVm {
  const { spec, result, provenance } = seg;
  const title = widgetTitle(spec);
  const width = spec.width ?? "full";

  if (result.kind === "error") {
    return { kind: "error", title, message: result.message, width, provenance };
  }

  switch (spec.view) {
    case "kanban":
      return buildKanban(title, width, spec, result, locale, provenance);
    case "list":
      return buildList(title, width, spec, result, provenance);
    case "table":
      return buildTable(title, width, spec, result, provenance);
    case "counter":
      return buildCounter(title, width, result, provenance);
    case "text":
      return {
        kind: "textWidget",
        title,
        width,
        markdown: result.kind === "text" ? result.text : "",
        provenance,
        inlineStyle: Boolean(provenance),
      };
    case "status":
      return buildStatus(title, width, result, provenance);
    default:
      return { kind: "error", title, message: `Unsupported view '${spec.view}'`, width, provenance };
  }
}

function buildKanban(
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
    const order =
      groupField === "state" && spec.source === "tasks"
        ? [...TASK_STATE_ORDER]
        : result.groups.map((g) => g.key);
    for (const key of order) {
      const group = result.groups.find((g) => g.key === key);
      const rows = group?.rows ?? [];
      columns.push({
        key: key ?? null,
        label: columnLabel(key ?? null, groupField, locale),
        cards: rows.map((row) => ({
          text: cellText(row.text),
          chips: fieldList
            .filter((f) => f !== "text")
            .map((f) => cellText(row[f]))
            .filter(Boolean),
        })),
      });
    }
  }

  const empty = columns.every((c) => c.cards.length === 0);
  return { kind: "kanban", title, width, columns, empty, provenance };
}

function buildList(
  title: string,
  width: WidgetWidth,
  spec: WidgetSpec,
  result: WidgetResult,
  provenance?: WidgetProvenance,
): DashboardWidgetVm {
  const fields = listFields(spec);
  const items: ListItemVm[] =
    result.kind === "rows"
      ? result.rows.map((row) => ({
          primary: cellText(row.text ?? row.label ?? Object.values(row)[0]),
          fields: fields.map((f) => cellText(row[f])).filter(Boolean),
        }))
      : [];
  return { kind: "list", title, width, items, empty: items.length === 0, provenance };
}

function buildTable(
  title: string,
  width: WidgetWidth,
  spec: WidgetSpec,
  result: WidgetResult,
  provenance?: WidgetProvenance,
): DashboardWidgetVm {
  const sample = result.kind === "rows" && result.rows[0] ? result.rows[0] : undefined;
  const columns = tableColumns(spec, sample);
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
  return { kind: "table", title, width, columns, rows, empty: rows.length === 0, provenance };
}

function buildCounter(
  title: string,
  width: WidgetWidth,
  result: WidgetResult,
  provenance?: WidgetProvenance,
): DashboardWidgetVm {
  if (result.kind === "value") {
    return {
      kind: "counter",
      title,
      width,
      value: result.value,
      delta: result.delta,
      empty: false,
      provenance,
    };
  }
  return { kind: "counter", title, width, value: 0, empty: true, provenance };
}

function buildStatus(
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
  return { kind: "status", title, width, cards, empty: cards.length === 0, provenance };
}

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
  emptyLabel: string,
): DashboardViewModel {
  const rows: DashboardRow[] = [];
  let widgetBuffer: DashboardWidgetVm[] = [];

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
    widgetBuffer.push(buildWidgetVm(segment, locale, emptyLabel));
  }
  flushWidgets();

  return { title: model.title, summary: model.summary, rows };
}

export function segmentCount(model: ResolvedDashboard): number {
  return model.segments.length;
}
