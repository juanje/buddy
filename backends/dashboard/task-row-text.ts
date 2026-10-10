// backends/dashboard/task-row-text.ts — Display text for dashboard task rows (FR-DASH-05).

/** Strip the due date token from task text for dashboard display (parser keeps it for round-trip). */
export function overdueDaysForTask(dueDate: string | undefined, today: string): number | undefined {
  if (!dueDate || dueDate >= today) return undefined;
  const startMs = new Date(`${dueDate}T12:00:00`).getTime();
  const endMs = new Date(`${today}T12:00:00`).getTime();
  return Math.floor((endMs - startMs) / (1000 * 60 * 60 * 24));
}

export function taskRowDisplayText(text: string, dueDate?: string): string {
  if (!dueDate) return text;
  let out = text.replace(new RegExp(`\\b${dueDate}\\b`), "");
  out = out.replace(/\s+/g, " ").trim();
  out = out.replace(/\s+([.,;:!?])/g, "$1");
  return out;
}
