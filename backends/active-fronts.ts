// backends/active-fronts.ts — Compute per-area WIP counts (FR-TASKM-41; superseded FR-TASKM-39).

import { isActiveTask, readTasksFile } from "./tasks/task-file";
import { WIP_DEFAULT, type TaskConfig } from "../shared/task-types";

export interface ActiveFrontsReport {
  perArea: Array<{ area: string; count: number }>;
  total: number;
}

/**
 * Computes active fronts from tasks.md (FR-TASKM-41).
 *
 * An active front in an area is each distinct `#project` slug with >=1 open,
 * non-someday item, plus 1 if any loose (untagged) open, non-someday items
 * exist in that area. A due date is a deadline and does not gate this
 * (FR-TASKM-08).
 */
export function computeActiveFronts(rootDir: string): ActiveFrontsReport {
  const { items } = readTasksFile(rootDir);
  const active = items.filter(isActiveTask);

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


export function formatActiveFrontsBlock(
  report: ActiveFrontsReport,
  config?: TaskConfig,
): string {
  const header = "Active fronts per area (from tasks.md):";
  if (report.total === 0) return `${header}\n(none)`;
  const lines = report.perArea.map((row) => {
    const areaName = row.area === "(general)" ? "(general)" : `@${row.area}`;
    const override = config?.wipLimitOverrides?.[row.area];
    const limitLabel =
      override === null
        ? "(no limit)"
        : `(limit: ${override ?? config?.wipLimit ?? WIP_DEFAULT})`;
    return `${areaName}: ${row.count} ${limitLabel}`;
  });
  return `${header}\n${lines.join("\n")}`;
}
