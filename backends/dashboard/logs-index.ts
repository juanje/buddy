// backends/dashboard/logs-index.ts — Parse logs/index.md lines (FR-DASH-18).

const LOG_INDEX_LINE =
  /^-\s+(\d{4}-\d{2}-\d{2}):\s+(\S+)\s+(?:\u2014|-)\s+(.*)$/;

export type LogIndexRow = {
  date: string;
  status: string;
  summary: string;
};

export function parseLogsIndex(content: string): LogIndexRow[] {
  const rows: LogIndexRow[] = [];
  for (const line of content.split(/\r?\n/)) {
    const match = LOG_INDEX_LINE.exec(line.trim());
    if (!match) continue;
    rows.push({ date: match[1], status: match[2], summary: match[3].trim() });
  }
  return rows;
}
