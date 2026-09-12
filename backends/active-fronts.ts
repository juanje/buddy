// backends/active-fronts.ts — Parse AGENTS.md Right now into per-area WIP counts (FR-TASKM-39).

import { extractRightNowSection } from "./consolidation-snapshot";

export interface ActiveFrontsReport {
  perArea: Array<{ area: string; count: number }>;
  total: number;
}

export function parseActiveFronts(agentsMdContent: string): ActiveFrontsReport {
  const section = extractRightNowSection(agentsMdContent);
  const counts = new Map<string, number>();
  for (const line of section.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("-")) continue;
    const areaMatch = trimmed.match(/\s@([\w-]+)\s*$/);
    const area = areaMatch ? areaMatch[1] : "(general)";
    counts.set(area, (counts.get(area) ?? 0) + 1);
  }
  const perArea = [...counts.entries()].map(([area, count]) => ({ area, count }));
  const total = perArea.reduce((sum, row) => sum + row.count, 0);
  return { perArea, total };
}

export function formatActiveFrontsBlock(report: ActiveFrontsReport): string {
  const header = "Active fronts per area (from AGENTS.md):";
  if (report.total === 0) return `${header}\n(none)`;
  const lines = report.perArea.map((row) =>
    row.area === "(general)" ? `(general): ${row.count}` : `@${row.area}: ${row.count}`,
  );
  return `${header}\n${lines.join("\n")}`;
}
