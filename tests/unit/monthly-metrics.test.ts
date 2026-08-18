// tests/unit/monthly-metrics.test.ts — FR-CONSOL-23.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { defaultConsolidationState } from "../../shared/consolidation-state";
import {
  computeMonthlyCoherenceFlags,
  computeMonthlyMetrics,
  formatMonthlyMetricsBlock,
} from "../../backends/monthly-metrics";

describe("monthly metrics", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("counts brain files by category", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-monthly-"));
    mkdirSync(join(dir, "agent_brain", "concepts"), { recursive: true });
    mkdirSync(join(dir, "agent_brain", "ideas"), { recursive: true });
    writeFileSync(join(dir, "agent_brain", "concepts", "a.md"), "---\nsummary: one\ncreated: 2026-01-01\n---\n");
    writeFileSync(join(dir, "agent_brain", "ideas", "b.md"), "---\nsummary: two\ncreated: 2026-01-01\n---\n");

    const metrics = computeMonthlyMetrics(dir, defaultConsolidationState());
    expect(metrics.concepts).toBe(1);
    expect(metrics.ideas).toBe(1);
    expect(formatMonthlyMetricsBlock(metrics, [])).toContain("Monthly brain metrics");
  });

  it("flags stale deferred and ideas", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-monthly-"));
    mkdirSync(join(dir, "agent_brain", "ideas"), { recursive: true });
    writeFileSync(join(dir, "AGENTS.md"), "## Active context\n\n### Right now\n- old item\n");
    writeFileSync(join(dir, "agent_brain", "deferred.md"), "- item\n");
    writeFileSync(
      join(dir, "agent_brain", "ideas", "stuck.md"),
      "---\nstatus: developing\ncreated: 2026-01-01\n---\n",
    );

    const state = defaultConsolidationState();
    state.lastDepth1 = "2026-06-01T10:00";
    const flags = computeMonthlyCoherenceFlags(dir, state, new Date("2026-08-17T12:00:00Z"));
    expect(flags.length).toBeGreaterThan(0);
  });
});
