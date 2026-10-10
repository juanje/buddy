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

export function overdueLabel(days: number, locale: AppLocale): string {
  if (locale === "es") {
    return days === 1 ? "vencida hace 1 día" : `vencida hace ${days} días`;
  }
  return days === 1 ? "overdue by 1 day" : `overdue by ${days} days`;
}
