// tests/unit/daily-coherence.test.ts — FR-CONSOL-20.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  computeDailyCoherence,
  detectInboxCoherence,
  detectResolvedDeferred,
  detectRightNowStaleness,
  extractLogDecisions,
  formatDailyCoherenceBlock,
} from "../../backends/daily-coherence";

describe("daily coherence", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("extracts decision keywords", () => {
    const log = "### Decisions\n- Project Alpha Phase 1 complete and shipped";
    const keywords = extractLogDecisions(log);
    expect(keywords.some((word) => word.includes("project") || word.includes("alpha"))).toBe(true);
  });

  it("detects right now staleness", () => {
    const flags = detectRightNowStaleness("- Project Alpha Phase 1 next", ["project", "alpha", "complete"]);
    expect(flags.length).toBeGreaterThan(0);
  });

  it("detects resolved deferred items", () => {
    const flags = detectResolvedDeferred(
      "- **reminder** (2026-08-16, daily): review quarterly budget",
      "Budget reconciliation completed today",
    );
    expect(flags.length).toBe(1);
  });

  it("detects task items resolved or parked in log", () => {
    const tasks = `- [ ] Apply corrections and run tests on the feature PR @work`;
    const log = "Feature PR parked temporarily; Alex will rebase when the codebase stabilizes";
    const flags = detectInboxCoherence(tasks, log);
    expect(flags.length).toBe(1);
    expect(flags[0]!.line).toContain("feature PR");
  });

  it("does not flag tasks when only area words overlap with distant completion language", () => {
    const tasks = `- [ ] Confirm docs @family`;
    const log = "family lunch was nice, PR completed";
    const flags = detectInboxCoherence(tasks, log);
    expect(flags).toHaveLength(0);
  });

  it("does not flag tasks when metadata tokens are stripped and completion is unrelated", () => {
    const tasks =
      `- [ ] Pay rent 2026-09-15 #housing @personal <!-- c:2026-09-01 -->`;
    const log = "housing discussion completed";
    const flags = detectInboxCoherence(tasks, log);
    expect(flags).toHaveLength(0);
  });

  it("flags genuine task completion when token and completion language share a log line", () => {
    const tasks = `- [ ] Apply corrections and run tests on feature PR @work`;
    const log = "feature PR corrections completed today";
    const flags = detectInboxCoherence(tasks, log);
    expect(flags).toHaveLength(1);
    expect(flags[0]!.line).toContain("corrections");
  });

  it("computes daily coherence from files", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-coherence-"));
    mkdirSync(join(dir, "logs"), { recursive: true });
    mkdirSync(join(dir, "agent_brain"), { recursive: true });
    writeFileSync(
      join(dir, "AGENTS.md"),
      "## Active context\n\n### Right now\n- Linux menu i18n bug\n",
    );
    writeFileSync(
      join(dir, "logs", "2026-08-17.md"),
      "### Decisions\n- Linux menu i18n resolved after installing v0.1.26\n",
    );
    writeFileSync(
      join(dir, "agent_brain", "deferred.md"),
      "- **decision** (2026-08-16, daily): investigate Linux menu i18n\n",
    );

    const result = computeDailyCoherence(dir, new Date("2026-08-17T12:00:00Z"));
    expect(formatDailyCoherenceBlock(result)).toContain("Daily coherence data");
  });

  it("includes current Right now items in coherence block with preservation directive", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-coherence-"));
    mkdirSync(join(dir, "agent_brain"), { recursive: true });
    writeFileSync(
      join(dir, "AGENTS.md"),
      "## Active context\n\n### Right now\n- Active project X\n- Pending task Y\n",
    );

    const result = computeDailyCoherence(dir, new Date("2026-08-17T12:00:00Z"));
    const block = formatDailyCoherenceBlock(result);
    expect(block).toContain("preserve all at depth 1");
    expect(block).toContain("Active project X");
    expect(block).toContain("Pending task Y");
  });
});
