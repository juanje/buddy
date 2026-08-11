// tests/unit/consolidation-content.test.ts — FR-CONSOL-01 new-content detection.

import { describe, expect, it } from "vitest";

import {
  hasNewContentSinceConsolidation,
  latestConsolidationTimestamp,
} from "../../backends/consolidation-content";
import { advanceCounters, defaultConsolidationState } from "../../shared/consolidation-state";
import { toLocalIsoStamp } from "../../shared/dates";

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

  it("stores local timestamps for git log --since comparisons", () => {
    const state = defaultConsolidationState();
    const now = new Date(2026, 7, 11, 3, 9);
    advanceCounters(state, 1, now);
    expect(state.lastDepth1).toBe(toLocalIsoStamp(now));
    expect(latestConsolidationTimestamp(state)).toBe(toLocalIsoStamp(now));
    expect(state.lastDepth1).not.toMatch(/Z$/);
  });
});
