// tests/unit/consolidation-state.test.ts — FR-CONSOL-01 counter logic.

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  advanceCounters,
  appendConsolidationLogEntry,
  cascadeDepths,
  defaultConsolidationState,
  determineTargetDepth,
  incrementSessionCounter,
  isDepthDue,
  loadConsolidationLog,
  loadConsolidationState,
  saveConsolidationState,
} from "../../shared/consolidation-state";

describe("consolidation state", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("returns defaults when state file is missing", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-consol-state-"));
    expect(loadConsolidationState(dir)).toEqual(defaultConsolidationState());
  });

  it("persists and reloads state", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-consol-state-"));
    const state = defaultConsolidationState();
    state.sessionsSinceLastDepth1 = 2;
    saveConsolidationState(dir, state);
    expect(existsSync(join(dir, ".buddy", "consolidation-state.json"))).toBe(true);
    expect(loadConsolidationState(dir).sessionsSinceLastDepth1).toBe(2);
  });

  it("determines target depth from counters", () => {
    const state = defaultConsolidationState();
    expect(determineTargetDepth(state)).toBeNull();

    state.sessionsSinceLastDepth1 = 3;
    expect(determineTargetDepth(state)).toBe(1);

    state.depth1RunsSinceLastDepth2 = 5;
    expect(determineTargetDepth(state)).toBe(2);

    state.depth2RunsSinceLastDepth3 = 4;
    expect(determineTargetDepth(state)).toBe(3);
  });

  it("advances counters per depth", () => {
    const state = defaultConsolidationState();
    state.sessionsSinceLastDepth1 = 3;
    state.depth1RunsSinceLastDepth2 = 2;

    advanceCounters(state, 1, new Date("2026-07-22T10:00:00Z"));
    expect(state.sessionsSinceLastDepth1).toBe(0);
    expect(state.depth1RunsSinceLastDepth2).toBe(3);
    expect(state.lastDepth1).toBe("2026-07-22T10:00:00.000Z");

    advanceCounters(state, 2, new Date("2026-07-22T11:00:00Z"));
    expect(state.depth1RunsSinceLastDepth2).toBe(0);
    expect(state.depth2RunsSinceLastDepth3).toBe(1);
    expect(state.lastDepth2).toBe("2026-07-22T11:00:00.000Z");
  });

  it("increments session counter", () => {
    const state = defaultConsolidationState();
    incrementSessionCounter(state);
    incrementSessionCounter(state);
    expect(state.sessionsSinceLastDepth1).toBe(2);
  });

  it("builds cascade depths", () => {
    expect(cascadeDepths(1)).toEqual([1]);
    expect(cascadeDepths(2)).toEqual([1, 2]);
    expect(cascadeDepths(3)).toEqual([1, 2, 3]);
  });

  it("checks depth due thresholds (session count)", () => {
    const state = defaultConsolidationState();
    expect(isDepthDue(1, state)).toBe(false);
    state.sessionsSinceLastDepth1 = 3;
    expect(isDepthDue(1, state)).toBe(true);
  });

  it("depth-1 fires on time threshold when content exists", () => {
    const state = defaultConsolidationState();
    const now = new Date("2026-07-22T12:00:00Z");
    state.lastDepth1 = "2026-07-21T10:00:00Z";
    state.sessionsSinceLastDepth1 = 0;
    expect(isDepthDue(1, state, now)).toBe(false);

    state.sessionsSinceLastDepth1 = 1;
    expect(isDepthDue(1, state, now)).toBe(true);
  });

  it("depth-1 does not fire on time alone without sessions", () => {
    const state = defaultConsolidationState();
    const now = new Date("2026-07-23T12:00:00Z");
    state.lastDepth1 = "2026-07-21T10:00:00Z";
    state.sessionsSinceLastDepth1 = 0;
    expect(isDepthDue(1, state, now)).toBe(false);
  });

  it("depth-1 does not fire on time when never consolidated", () => {
    const state = defaultConsolidationState();
    state.sessionsSinceLastDepth1 = 1;
    expect(isDepthDue(1, state, new Date())).toBe(false);
  });

  it("depth-1 requires 3 sessions on fresh instance", () => {
    const state = defaultConsolidationState();
    state.sessionsSinceLastDepth1 = 2;
    expect(isDepthDue(1, state)).toBe(false);
    state.sessionsSinceLastDepth1 = 3;
    expect(isDepthDue(1, state)).toBe(true);
  });

  it("appends consolidation log entries", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-consol-state-"));
    appendConsolidationLogEntry(dir, {
      timestamp: "2026-07-22T10:00:00Z",
      depth: 1,
      duration_ms: 100,
      status: "success",
    });
    const log = loadConsolidationLog(dir);
    expect(log).toHaveLength(1);
    expect(JSON.parse(readFileSync(join(dir, ".buddy", "consolidation-log.json"), "utf8"))).toHaveLength(
      1,
    );
  });
});
