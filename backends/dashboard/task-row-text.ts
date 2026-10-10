// backends/dashboard/task-row-text.ts — Display text for dashboard task rows (FR-DASH-05).

/** Strip the due date token from task text for dashboard display (parser keeps it for round-trip). */
export function taskRowDisplayText(text: string, dueDate?: string): string {
  if (!dueDate) return text;
  let out = text.replace(new RegExp(`\\b${dueDate}\\b`), "");
  out = out.replace(/\s+/g, " ").trim();
  out = out.replace(/\s+([.,;:!?])/g, "$1");
  return out;
}
