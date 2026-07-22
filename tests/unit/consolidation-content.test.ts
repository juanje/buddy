// tests/unit/consolidation-content.test.ts — FR-CONSOL-01 new-content detection.

import { describe, expect, it } from "vitest";

import {
  hasNewContentSinceConsolidation,
  latestConsolidationTimestamp,
} from "../../backends/consolidation-content";
import { defaultConsolidationState } from "../../shared/consolidation-state";

describe("consolidation content detection", () => {
  it("returns null when no consolidation has run", () => {
    expect(latestConsolidationTimestamp(defaultConsolidationState())).toBeNull();
  });

  it("picks the latest timestamp across depths", () => {
    const state = defaultConsolidationState();
    state.lastDepth1 = "2026-07-20T10:00:00Z";
    state.lastDepth2 = "2026-07-21T10:00:00Z";
    expect(latestConsolidationTimestamp(state)).toBe("2026-07-21T10:00:00Z");
  });

  it("treats never-consolidated state as having content", async () => {
    const dir = "/tmp/nonexistent-ab-for-consol-test";
    await expect(hasNewContentSinceConsolidation(dir, defaultConsolidationState())).resolves.toBe(
      true,
    );
  });
});
