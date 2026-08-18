// tests/unit/consolidation-snapshot.test.ts — FR-CONSOL-19.

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  computeWeeklyDiff,
  extractRightNowSection,
  formatWeeklyDiffBlock,
  snapshotForDiff,
} from "../../backends/consolidation-snapshot";

describe("consolidation snapshot", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("extracts Right now section", () => {
    const agents = `## Active context\n\n### Right now\n- item one\n- item two\n\n### Files\n- file`;
    expect(extractRightNowSection(agents)).toContain("item one");
  });

  it("snapshots user and right now content", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-snapshot-"));
    mkdirSync(join(dir, "agent_brain", "identity"), { recursive: true });
    writeFileSync(join(dir, "AGENTS.md"), "## Active context\n\n### Right now\n- hot\n");
    writeFileSync(join(dir, "agent_brain", "identity", "USER.md"), "# User\n");

    const snapshot = snapshotForDiff(dir, new Date("2026-08-17T12:00:00Z"));
    expect(snapshot.rightNowContent).toContain("hot");
    expect(snapshot.userMdHash).toBeTruthy();
  });

  it("computes weekly diff when snapshot exists", async () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-snapshot-"));
    mkdirSync(join(dir, "agent_brain", "identity"), { recursive: true });
    writeFileSync(join(dir, "AGENTS.md"), "## Active context\n\n### Right now\n- old\n");
    writeFileSync(join(dir, "agent_brain", "identity", "USER.md"), "before\n");

    const previous = snapshotForDiff(dir);
    writeFileSync(join(dir, "agent_brain", "identity", "USER.md"), "after\n");

    const diff = await computeWeeklyDiff(dir, previous, "2026-08-10T00:00:00Z");
    expect(diff.userMdChanged).toBe(true);
    expect(formatWeeklyDiffBlock(diff)).toContain("USER.md");
    expect(existsSync(join(dir, "agent_brain", "identity", "USER.md"))).toBe(true);
  });
});
