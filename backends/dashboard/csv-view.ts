// backends/dashboard/csv-view.ts — CSV inline viewer limits (FR-CHAT-22).

const DEFAULT_CAP = 5000;

/** Max rows loaded when opening a CSV in the viewer. Override in tests via env. */
export function csvViewRowCap(): number {
  const raw = process.env.BUDDY_CSV_VIEW_ROW_CAP;
  if (raw !== undefined && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return DEFAULT_CAP;
}
