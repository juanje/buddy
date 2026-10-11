// shared/dashboard/inline-refresh.ts — Stale refresh widgets for consolidation (FR-DASH-16).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { parseDashboardDocument, parseDashboardParts } from "./parse";
import { ageDaysFromUpdated, validateInlineMetadata } from "./inline-source";
import { parseDashboardYamlBlock } from "./yaml-blocks";

export type StaleRefreshWidget = {
  dashboardPath: string;
  title: string;
  refresh: "daily" | "weekly";
  updated: string;
};

const DASHBOARDS_DIR = "user/dashboards";

function listDashboardMarkdownFiles(rootDir: string): string[] {
  const base = join(rootDir, DASHBOARDS_DIR);
  if (!existsSync(base)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, name.name);
      if (name.isDirectory()) walk(abs);
      else if (name.isFile() && name.name.endsWith(".md")) {
        out.push(relative(rootDir, abs).replace(/\\/g, "/"));
      }
    }
  };
  walk(base);
  return out.sort();
}

function refreshMode(raw: Record<string, unknown>): "daily" | "weekly" | undefined {
  const r = raw.refresh;
  if (r === "daily" || r === "weekly") return r;
  return undefined;
}

function isStale(refresh: "daily" | "weekly", updated: string, today: string): boolean {
  const age = ageDaysFromUpdated(updated, today);
  if (refresh === "daily") return age >= 1;
  return age >= 7;
}

export function findStaleRefreshWidgets(
  rootDir: string,
  today: string,
  depth: number,
): StaleRefreshWidget[] {
  const stale: StaleRefreshWidget[] = [];
  for (const relPath of listDashboardMarkdownFiles(rootDir)) {
    let content: string;
    try {
      content = readFileSync(join(rootDir, relPath), "utf8");
    } catch {
      continue;
    }
    const { body } = parseDashboardDocument(content);
    for (const part of parseDashboardParts(body)) {
      if (part.kind !== "dashboard_block") continue;
      const parsed = parseDashboardYamlBlock(part.yaml);
      if (!parsed.ok) continue;
      for (const item of parsed.items) {
        if (item.source !== "inline") continue;
        const mode = refreshMode(item);
        if (!mode) continue;
        if (mode === "daily" && depth !== 1) continue;
        if (mode === "weekly" && depth !== 2) continue;
        if (validateInlineMetadata(item)) continue;
        const updated = String(item.updated);
        if (!isStale(mode, updated, today)) continue;
        const title = typeof item.title === "string" && item.title.trim() ? item.title.trim() : "(untitled)";
        stale.push({ dashboardPath: relPath, title, refresh: mode, updated });
      }
    }
  }
  return stale;
}

export function formatStaleRefreshWidgetsBlock(
  rootDir: string,
  today: string,
  depth: number,
): string | undefined {
  const widgets = findStaleRefreshWidgets(rootDir, today, depth);
  if (widgets.length === 0) return undefined;
  const lines = [
    "Stale inline dashboard widgets (refresh with dashboard(action='update') for one widget at a time):",
    ...widgets.map(
      (w) =>
        `- ${w.dashboardPath} — "${w.title}" refresh ${w.refresh} updated ${w.updated}`,
    ),
  ];
  return lines.join("\n");
}
