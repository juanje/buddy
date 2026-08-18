// backends/monthly-metrics.ts — Monthly metrics computation (FR-CONSOL-23).

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import type { ConsolidationState } from "../shared/consolidation-state";
import { MS_PER_DAY } from "../shared/dates";
import { brainDirPath } from "./brain-paths";
import { extractRightNowSection } from "./consolidation-snapshot";
import { parseObservations } from "./observation-hygiene";

export interface MonthlyMetrics {
  concepts: number;
  ideas: number;
  skills: number;
  projects: number;
  observationsTotal: number;
  observationsResolved: number;
  growthSinceLastDepth3: Record<"concepts" | "ideas" | "skills" | "projects", number>;
}

export interface MonthlyCoherenceFlag {
  kind: "right-now-stale" | "deferred-stale" | "idea-stuck";
  detail: string;
}

function countMarkdownRecursive(dir: string): number {
  if (!existsSync(dir)) return 0;
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) count += countMarkdownRecursive(path);
    else if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "index.md") count += 1;
  }
  return count;
}

function readAgentsMd(rootDir: string): string {
  const path = join(rootDir, "AGENTS.md");
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8");
}

function daysSince(iso: string | null, now: Date): number {
  if (!iso) return Infinity;
  const stamp = new Date(iso);
  if (Number.isNaN(stamp.getTime())) return Infinity;
  return (now.getTime() - stamp.getTime()) / MS_PER_DAY;
}

export function computeMonthlyMetrics(
  rootDir: string,
  _state: ConsolidationState,
  _now: Date = new Date(),
): MonthlyMetrics {
  const brain = brainDirPath(rootDir);
  const counts: Record<"concepts" | "ideas" | "skills" | "projects", number> = {
    concepts: countMarkdownRecursive(join(brain, "concepts")),
    ideas: countMarkdownRecursive(join(brain, "ideas")),
    skills: countMarkdownRecursive(join(brain, "skills")),
    projects: countMarkdownRecursive(join(brain, "projects")),
  };

  const observationsPath = join(brain, "observations.md");
  let observationsTotal = 0;
  let observationsResolved = 0;
  if (existsSync(observationsPath)) {
    const parsed = parseObservations(readFileSync(observationsPath, "utf8"));
    observationsTotal = parsed.length;
    observationsResolved = parsed.filter((entry) => entry.isResolved).length;
  }

  const growthSinceLastDepth3 = {
    concepts: counts.concepts,
    ideas: counts.ideas,
    skills: counts.skills,
    projects: counts.projects,
  };

  return {
    ...counts,
    observationsTotal,
    observationsResolved,
    growthSinceLastDepth3,
  };
}

export function computeMonthlyCoherenceFlags(
  rootDir: string,
  state: ConsolidationState,
  now: Date = new Date(),
): MonthlyCoherenceFlag[] {
  const flags: MonthlyCoherenceFlag[] = [];
  const rightNow = extractRightNowSection(readAgentsMd(rootDir));
  if (rightNow.trim() && daysSince(state.lastDepth1, now) > 30) {
    flags.push({
      kind: "right-now-stale",
      detail: '"Right now" content may be unchanged for 30+ days since last depth-1 update',
    });
  }

  const deferredPath = join(brainDirPath(rootDir), "deferred.md");
  if (existsSync(deferredPath)) {
    const mtime = statSync(deferredPath).mtime;
    if (daysSince(mtime.toISOString(), now) > 14) {
      flags.push({
        kind: "deferred-stale",
        detail: "deferred.md has not been modified in 14+ days",
      });
    }
  }

  const ideasDir = join(brainDirPath(rootDir), "ideas");
  if (existsSync(ideasDir)) {
    for (const entry of readdirSync(ideasDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const path = join(ideasDir, entry.name);
      const content = readFileSync(path, "utf8");
      if (!/status:\s*developing/i.test(content)) continue;
      if (daysSince(statSync(path).mtime.toISOString(), now) > 60) {
        flags.push({
          kind: "idea-stuck",
          detail: `${entry.name} has been developing for 60+ days without changes`,
        });
      }
    }
  }

  return flags;
}

export function formatMonthlyMetricsBlock(
  metrics: MonthlyMetrics,
  flags: MonthlyCoherenceFlag[],
): string {
  const lines = [
    "Monthly brain metrics:",
    `- concepts: ${metrics.concepts}, ideas: ${metrics.ideas}, skills: ${metrics.skills}, projects: ${metrics.projects}`,
    `- observations: ${metrics.observationsTotal} total, ${metrics.observationsResolved} resolved`,
  ];

  if (flags.length === 0) {
    lines.push("Monthly coherence flags: none");
  } else {
    lines.push("Monthly coherence flags:");
    for (const flag of flags) {
      lines.push(`- [${flag.kind}] ${flag.detail}`);
    }
  }

  return lines.join("\n");
}
