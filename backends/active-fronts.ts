// backends/active-fronts.ts — Compute per-area WIP counts (FR-TASKM-41; superseded FR-TASKM-39).

import { readTasksFile } from "./tasks/task-file";
import { toIsoDay } from "../shared/dates";

export interface ActiveFrontsReport {
  perArea: Array<{ area: string; count: number }>;
  total: number;
}

/**
 * Computes active fronts from tasks.md (FR-TASKM-41).
 *
 * An active front in an area is each distinct `#project` slug with >=1 open,
 * non-someday, non-future item, plus 1 if any loose (untagged) open,
 * non-someday, non-future items exist in that area.
 */
export function computeActiveFronts(rootDir: string): ActiveFrontsReport {
  const { items } = readTasksFile(rootDir);
  const today = toIsoDay(new Date());
  const active = items.filter(
    (item) =>
      !item.done && item.area !== "someday" && !(item.dueDate && item.dueDate > today),
  );

  const areaMap = new Map<string, { projects: Set<string>; hasLoose: boolean }>();
  for (const item of active) {
    const area = item.area?.trim() || "(general)";
    const entry = areaMap.get(area) ?? { projects: new Set<string>(), hasLoose: false };
    if (item.project) {
      entry.projects.add(item.project);
    } else {
      entry.hasLoose = true;
    }
    areaMap.set(area, entry);
  }

  const perArea = [...areaMap.entries()].map(([area, entry]) => ({
    area,
    count: entry.projects.size + (entry.hasLoose ? 1 : 0),
  }));
  const total = perArea.reduce((sum, row) => sum + row.count, 0);
  return { perArea, total };
}


export function formatActiveFrontsBlock(report: ActiveFrontsReport): string {
  const header = "Active fronts per area (from tasks.md):";
  if (report.total === 0) return `${header}\n(none)`;
  const lines = report.perArea.map((row) =>
    row.area === "(general)" ? `(general): ${row.count}` : `@${row.area}: ${row.count}`,
  );
  return `${header}\n${lines.join("\n")}`;
}
