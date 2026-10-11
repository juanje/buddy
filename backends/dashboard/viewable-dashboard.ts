// backends/dashboard/viewable-dashboard.ts — Worker RPC for dashboard resolution (FR-DASH-02).

import { basename } from "node:path";
import { readFileSync } from "node:fs";

import { splitFrontmatter } from "../../shared/frontmatter";
import { isDashboardDocument } from "../../shared/dashboard/document";
import type { ResolvedDashboard } from "../../shared/dashboard/types";
import { toIsoDay } from "../../shared/dates";
import { resolveViewableFile, ViewableFileError } from "../viewable-file";
import { csvViewRowCap } from "./csv-view";
import { resolveDashboardContent } from "./resolve";
import { loadSeriesSource } from "./series-load";

export class DashboardFileError extends ViewableFileError {}

function yamlColumnList(columns: string[]): string {
  return columns
    .map((c) => (/^[\w]+$/.test(c) ? c : `"${c.replace(/"/g, '\\"')}"`))
    .join(", ");
}

function resolveViewableCsvDashboard(
  rootDir: string,
  relPath: string,
  todayStr: string,
): ResolvedDashboard {
  const title = basename(relPath);
  const loaded = loadSeriesSource(rootDir, relPath);
  if (!loaded.ok) {
    return {
      title,
      today: todayStr,
      segments: [
        {
          kind: "widget",
          spec: {
            view: "table",
            source: "series",
            raw: { path: relPath, columns: [] },
          },
          result: { kind: "error", message: loaded.message },
        },
      ],
    };
  }

  const cap = csvViewRowCap();
  const totalRows = loaded.rows.length;
  const columns = loaded.header;
  const synthetic = `---
type: dashboard
title: ${title}
---

\`\`\`dashboard
- view: table
  source: series
  path: ${relPath}
  columns: [${yamlColumnList(columns)}]
  limit: ${cap}
\`\`\`
`;
  const model = resolveDashboardContent(rootDir, synthetic, todayStr);
  const segments = [...model.segments];
  if (totalRows > cap) {
    segments.push({
      kind: "text",
      markdown: `Showing ${cap} of ${totalRows} rows`,
    });
  }
  return { ...model, title, segments, today: todayStr };
}

export function resolveViewableDashboard(
  rootDir: string,
  rawHref: string,
  today?: string,
): ResolvedDashboard {
  const { relPath } = resolveViewableFile(rootDir, rawHref);
  const todayStr = today ?? toIsoDay(new Date());

  if (/\.csv$/i.test(relPath)) {
    return resolveViewableCsvDashboard(rootDir, relPath, todayStr);
  }

  const { absPath } = resolveViewableFile(rootDir, rawHref);
  const content = readFileSync(absPath, "utf8");
  const { fields } = splitFrontmatter(content);
  if (!isDashboardDocument(relPath, fields)) {
    throw new DashboardFileError("This file is not a dashboard.");
  }
  const model = resolveDashboardContent(rootDir, content, todayStr);
  return { ...model, today: todayStr };
}
