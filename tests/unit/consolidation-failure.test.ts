// tests/unit/consolidation-failure.test.ts — FR-CONSOL-09 backoff and ceiling.
//
// Before H3 a depth that failed deterministically retried on every heartbeat
// tick forever, each retry a billed LLM call. These are the guards.

import { describe, expect, it } from "vitest";

import {
  backoffDelayMs,
  clearDepthFailure,
  defaultConsolidationState,
  depthBlockReason,
  depthFailureCount,
  determineTargetDepth,
  recordDepthFailure,
  advanceCounters,
  type ConsolidationState,
} from "../../shared/consolidation-state";
import {
  CONSOLIDATION_BACKOFF_BASE_MS,
  CONSOLIDATION_RETRY_CEILING,
} from "../../shared/defaults";

const NOW = new Date("2026-07-27T12:00:00.000Z");

function dueState(): ConsolidationState {
  const state = defaultConsolidationState();
  state.sessionsSinceLastDepth1 = 3;
  return state;
}

function at(offsetMs: number): Date {
  return new Date(NOW.getTime() + offsetMs);
}

describe("backoffDelayMs", () => {
  it("doubles per consecutive failure", () => {
    expect(backoffDelayMs(0)).toBe(0);
    expect(backoffDelayMs(1)).toBe(CONSOLIDATION_BACKOFF_BASE_MS);
    expect(backoffDelayMs(2)).toBe(CONSOLIDATION_BACKOFF_BASE_MS * 2);
    expect(backoffDelayMs(3)).toBe(CONSOLIDATION_BACKOFF_BASE_MS * 4);
  });
});

describe("recordDepthFailure", () => {
  it("counts consecutive failures per depth independently", () => {
    const state = dueState();
    recordDepthFailure(state, 1, NOW);
    recordDepthFailure(state, 1, NOW);
    recordDepthFailure(state, 2, NOW);

    expect(depthFailureCount(state, 1)).toBe(2);
    expect(depthFailureCount(state, 2)).toBe(1);
    expect(depthFailureCount(state, 3)).toBe(0);
  });

  it("survives a save/load round trip as plain JSON", () => {
    const state = dueState();
    recordDepthFailure(state, 2, NOW);
    const restored = JSON.parse(JSON.stringify(state)) as ConsolidationState;
    expect(depthFailureCount(restored, 2)).toBe(1);
  });
});

describe("depthBlockReason", () => {
  it("reports no block for a clean depth", () => {
    expect(depthBlockReason(dueState(), 1, NOW)).toBeNull();
  });

  it("blocks with backoff immediately after a failure", () => {
    const state = dueState();
    recordDepthFailure(state, 1, NOW);
    expect(depthBlockReason(state, 1, at(60_000))).toBe("backoff");
  });

  it("clears the block once the backoff window elapses", () => {
    const state = dueState();
    recordDepthFailure(state, 1, NOW);
    expect(depthBlockReason(state, 1, at(CONSOLIDATION_BACKOFF_BASE_MS + 1))).toBeNull();
  });

  it("widens the window as failures accumulate", () => {
    const state = dueState();
    recordDepthFailure(state, 1, NOW);
    recordDepthFailure(state, 1, NOW);
    // One base interval is no longer enough at two failures.
    expect(depthBlockReason(state, 1, at(CONSOLIDATION_BACKOFF_BASE_MS + 1))).toBe("backoff");
    expect(depthBlockReason(state, 1, at(CONSOLIDATION_BACKOFF_BASE_MS * 2 + 1))).toBeNull();
  });

  it("abandons the depth at the ceiling, regardless of elapsed time", () => {
    const state = dueState();
    for (let i = 0; i < CONSOLIDATION_RETRY_CEILING; i++) {
      recordDepthFailure(state, 1, NOW);
    }
    expect(depthBlockReason(state, 1, at(365 * 24 * 60 * 60 * 1000))).toBe("abandoned");
  });
});

describe("clearDepthFailure", () => {
  it("resets the count so the depth is runnable again", () => {
    const state = dueState();
    recordDepthFailure(state, 1, NOW);
    clearDepthFailure(state, 1);
    expect(depthFailureCount(state, 1)).toBe(0);
    expect(depthBlockReason(state, 1, NOW)).toBeNull();
  });

  it("is applied automatically by a successful advance", () => {
    const state = dueState();
    recordDepthFailure(state, 1, NOW);
    advanceCounters(state, 1, NOW);
    expect(depthFailureCount(state, 1)).toBe(0);
  });
});

describe("determineTargetDepth with failures", () => {
  it("returns null while the only due depth is in backoff", () => {
    const state = dueState();
    recordDepthFailure(state, 1, NOW);
    expect(determineTargetDepth(state, at(60_000))).toBeNull();
  });

  it("returns the depth again once backoff expires", () => {
    const state = dueState();
    recordDepthFailure(state, 1, NOW);
    expect(determineTargetDepth(state, at(CONSOLIDATION_BACKOFF_BASE_MS + 1))).toBe(1);
  });

  it("falls through to a lower depth when the higher one is abandoned", () => {
    // A broken weekly consolidation must not stop the daily one.
    const state = dueState();
    state.depth1RunsSinceLastDepth2 = 5;
    for (let i = 0; i < CONSOLIDATION_RETRY_CEILING; i++) {
      recordDepthFailure(state, 2, NOW);
    }
    expect(determineTargetDepth(state, NOW)).toBe(1);
  });
});
