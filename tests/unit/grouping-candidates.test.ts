// tests/unit/grouping-candidates.test.ts — FR-CONSOL-22.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  detectGroupingCandidates,
  formatGroupingCandidatesBlock,
} from "../../backends/grouping-candidates";

describe("grouping candidates", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("detects keyword clusters at directory roots", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-grouping-"));
    const concepts = join(dir, "agent_brain", "concepts");
    mkdirSync(concepts, { recursive: true });
    for (let i = 1; i <= 3; i += 1) {
      writeFileSync(
        join(concepts, `memory-topic-${i}.md`),
        `---\nsummary: agent memory pattern ${i}\ncreated: 2026-08-01\n---\n`,
      );
    }

    const candidates = detectGroupingCandidates(dir);
    expect(candidates.length).toBeGreaterThan(0);
    expect(formatGroupingCandidatesBlock(candidates)).toContain("Grouping candidates");
  });
});
