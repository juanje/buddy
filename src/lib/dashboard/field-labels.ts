// src/lib/dashboard/field-labels.ts — Humanized table column labels (FR-DASH-10).

import type { AppLocale } from "../i18n";

const TASK_FIELDS: Record<AppLocale, Record<string, string>> = {
  en: {
    text: "Task",
    area: "Area",
    project: "Project",
    due: "Due",
    created: "Created",
    state: "State",
    stale_days: "Stale days",
    overdue_days: "Overdue days",
  },
  es: {
    text: "Tarea",
    area: "Área",
    project: "Proyecto",
    due: "Vence",
    created: "Creada",
    state: "Estado",
    stale_days: "Días sin tocar",
    overdue_days: "Días de retraso",
  },
};

const DEFERRED_FIELDS: Record<AppLocale, Record<string, string>> = {
  en: {
    type: "Type",
    date: "Date",
    source: "Source",
    text: "Text",
  },
  es: {
    type: "Tipo",
    date: "Fecha",
    source: "Origen",
    text: "Texto",
  },
};

/** Display task field values like tasks.md (@area, #project). FR-DASH-10 */
export function displayFieldValue(
  field: string,
  value: string,
  source: string | undefined,
): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (source === "tasks" && field === "area") return `@${trimmed}`;
  if (source === "tasks" && field === "project") return `#${trimmed}`;
  return trimmed;
}

export function humanizeFieldLabel(
  field: string,
  source: string | undefined,
  locale: AppLocale,
): string {
  if (source === "tasks" && TASK_FIELDS[locale][field]) {
    return TASK_FIELDS[locale][field];
  }
  if (source === "deferred" && DEFERRED_FIELDS[locale][field]) {
    return DEFERRED_FIELDS[locale][field];
  }
  const spaced = field.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const VIEW_LABELS: Record<AppLocale, Record<string, string>> = {
  en: {
    kanban: "Kanban",
    list: "List",
    table: "Table",
    counter: "Counter",
    text: "Text",
    status: "Status",
  },
  es: {
    kanban: "Kanban",
    list: "Lista",
    table: "Tabla",
    counter: "Contador",
    text: "Texto",
    status: "Estado",
  },
};

/** Localized view name for error cards when a widget has no title (FR-DASH-10). */
export function viewLabel(view: string, locale: AppLocale): string {
  return VIEW_LABELS[locale][view] ?? humanizeFieldLabel(view, undefined, locale);
}

export function overdueLabel(days: number, locale: AppLocale): string {
  if (locale === "es") {
    return days === 1 ? "vencida hace 1 día" : `vencida hace ${days} días`;
  }
  return days === 1 ? "overdue by 1 day" : `overdue by ${days} days`;
}
