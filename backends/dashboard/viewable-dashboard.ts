// backends/dashboard/viewable-dashboard.ts — Worker RPC for dashboard resolution (FR-DASH-02).

import { readFileSync } from "node:fs";

import { splitFrontmatter } from "../../shared/frontmatter";
import { isDashboardDocument } from "../../shared/dashboard/document";
import type { ResolvedDashboard } from "../../shared/dashboard/types";
import { toIsoDay } from "../../shared/dates";
import { resolveViewableFile, ViewableFileError } from "../viewable-file";
import { resolveDashboardContent } from "./resolve";

export class DashboardFileError extends ViewableFileError {}

export function resolveViewableDashboard(
  rootDir: string,
  rawHref: string,
  today?: string,
): ResolvedDashboard {
  const { relPath, absPath } = resolveViewableFile(rootDir, rawHref);
  const content = readFileSync(absPath, "utf8");
  const { fields } = splitFrontmatter(content);
  if (!isDashboardDocument(relPath, fields)) {
    throw new DashboardFileError("This file is not a dashboard.");
  }
  const todayStr = today ?? toIsoDay(new Date());
  const model = resolveDashboardContent(rootDir, content, todayStr);
  return { ...model, today: todayStr };
}
