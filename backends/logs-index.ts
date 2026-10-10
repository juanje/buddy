// backends/logs-index.ts — Parse logs/index.md lines (FR-DASH-18, shared).

const LOG_INDEX_DATE = /^-\s+(\d{4}-\d{2}-\d{2}):\s*(.*)$/;

export type LogIndexRow = {
  date: string;
  status?: string;
  summary: string;
};

function parseLogIndexLine(rest: string): Pick<LogIndexRow, "status" | "summary"> {
  const trimmed = rest.trim();
  if (!trimmed) return { summary: "" };
  const withSummary = /^(\S+)\s+(?:—|-)\s+(.*)$/.exec(trimmed);
  if (withSummary) {
    return { status: withSummary[1], summary: withSummary[2].trim() };
  }
  return { status: trimmed.split(/\s+/)[0], summary: "" };
}

export function parseLogsIndex(content: string): LogIndexRow[] {
  const rows: LogIndexRow[] = [];
  for (const line of content.split(/\r?\n/)) {
    const match = LOG_INDEX_DATE.exec(line.trim());
    if (!match) continue;
    const { status, summary } = parseLogIndexLine(match[2]);
    rows.push({ date: match[1], status, summary });
  }
  return rows;
}

export function lastLogIndexDate(rows: LogIndexRow[]): string | undefined {
  return rows.at(-1)?.date;
}

export function activeLogIndexDates(rows: LogIndexRow[]): string[] {
  return rows.filter((row) => row.status === "active").map((row) => row.date);
}
