// backends/dashboard/bundled-dashboards.ts — Shipped dashboard templates (FR-DASH-13).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getEmbeddedAssets } from "../embedded-assets";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_DASHBOARDS_DIR = join(MODULE_DIR, "..", "..", "bundled", "dashboards");

const TEMPLATE_ALIASES: Record<string, string> = {
  "mis-tareas": "mis-tareas.md",
  "mis_tareas": "mis-tareas.md",
  "mi-semana": "mi-semana.md",
  "mi_semana": "mi-semana.md",
};

function embeddedDashboards(): Record<string, string> | undefined {
  return getEmbeddedAssets()?.dashboards;
}

export function bundledDashboardContent(relPath: string): string | undefined {
  const embedded = embeddedDashboards();
  if (embedded?.[relPath]) return embedded[relPath];
  const abs = join(REPO_DASHBOARDS_DIR, relPath);
  if (existsSync(abs)) return readFileSync(abs, "utf8");
  return undefined;
}

export function resolveDashboardTemplate(name: string): string | undefined {
  const rel = TEMPLATE_ALIASES[name] ?? (name.endsWith(".md") ? name : `${name}.md`);
  return bundledDashboardContent(rel);
}

export function listExampleDashboardPaths(): string[] {
  const embedded = embeddedDashboards();
  if (embedded) {
    return Object.keys(embedded).filter((p) => p.startsWith("examples/") && p.endsWith(".md"));
  }
  const examplesDir = join(REPO_DASHBOARDS_DIR, "examples");
  if (!existsSync(examplesDir)) return [];
  return readdirSync(examplesDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => `examples/${f}`);
}
