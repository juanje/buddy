// shared/dates.ts — Date formatting shared across backends.

export function toIsoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Extract HH:MM from an ISO timestamp string. */
export function formatLocalTime(isoTimestamp: string): string {
  return isoTimestamp.slice(11, 16);
}
