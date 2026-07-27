// tests/unit/heartbeat.test.ts — FR-DEFERRED-02 + FR-CONSOL-01/05 heartbeat.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { startHeartbeat } from "../../backends/heartbeat";
import type { RunConsolidationOptions } from "../../backends/consolidation-runner";
import { defaultConsolidationState } from "../../shared/consolidation-state";
import { TEST_FROZEN_NOW, TEST_HEARTBEAT_INTERVAL_MS } from "../support/test-constants";

describe("heartbeat", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  function setupAb(): void {
    dir = mkdtempSync(join(tmpdir(), "ab-heartbeat-"));
    mkdirSync(join(dir, "agent_brain"), { recursive: true });
  }

  it("notifies frontend of due deferred items on tick", async () => {
    setupAb();
    writeFileSync(
      join(dir, "agent_brain", "deferred.md"),
      "- **reminder** (2026-07-22, user): Call dentist.\n",
    );

    const onDeferredDue = vi.fn();
    const hb = startHeartbeat({
      rootDir: dir,
      modelRuntime: {} as never,
      isStreaming: () => false,
      onDeferredDue,
      intervalMs: TEST_HEARTBEAT_INTERVAL_MS,
      now: () => TEST_FROZEN_NOW,
      hasNewContentFn: async () => false,
    });

    await hb.tick();
    hb.stop();

    expect(onDeferredDue).toHaveBeenCalled();
    const lastCall = onDeferredDue.mock.calls.at(-1)?.[0];
    expect(lastCall).toEqual([
      expect.objectContaining({ text: "Call dentist.", overdue: false }),
    ]);
  });

  it("defers consolidation while the user is streaming", async () => {
    setupAb();
    const runConsolidationFn = vi.fn(async (_options: RunConsolidationOptions) => ({
      ran: true,
      completedDepths: [1],
      state: defaultConsolidationState(), abandonedDepths: [] }));

    const hb = startHeartbeat({
      rootDir: dir,
      modelRuntime: {} as never,
      isStreaming: () => true,
      onDeferredDue: vi.fn(),
      intervalMs: TEST_HEARTBEAT_INTERVAL_MS,
      runConsolidationFn,
      hasNewContentFn: async () => true,
    });

    hb.incrementSessionCounter();
    hb.incrementSessionCounter();
    hb.incrementSessionCounter();

    await hb.tick();
    hb.stop();

    expect(runConsolidationFn).not.toHaveBeenCalled();
  });

  it("runs consolidation when idle and thresholds are met", async () => {
    setupAb();
    const runConsolidationFn = vi.fn(async (_options: RunConsolidationOptions) => ({
      ran: true,
      completedDepths: [1],
      state: defaultConsolidationState(), abandonedDepths: [] }));

    const hb = startHeartbeat({
      rootDir: dir,
      modelRuntime: {} as never,
      isStreaming: () => false,
      onDeferredDue: vi.fn(),
      intervalMs: TEST_HEARTBEAT_INTERVAL_MS,
      runConsolidationFn,
      hasNewContentFn: async () => true,
    });

    hb.incrementSessionCounter();
    hb.incrementSessionCounter();
    hb.incrementSessionCounter();

    await hb.tick();
    hb.stop();

    expect(runConsolidationFn).toHaveBeenCalledTimes(1);
    const firstCall = runConsolidationFn.mock.calls[0];
    expect(firstCall?.[0]?.targetDepth).toBe(1);
  });

  it("skips consolidation when budget is near limit", async () => {
    setupAb();
    const runConsolidationFn = vi.fn(async (_options: RunConsolidationOptions) => ({
      ran: true,
      completedDepths: [1],
      state: defaultConsolidationState(), abandonedDepths: [] }));

    const hb = startHeartbeat({
      rootDir: dir,
      modelRuntime: {} as never,
      isStreaming: () => false,
      onDeferredDue: vi.fn(),
      intervalMs: TEST_HEARTBEAT_INTERVAL_MS,
      runConsolidationFn,
      hasNewContentFn: async () => true,
      isBudgetNearLimit: () => true,
    });

    hb.incrementSessionCounter();
    hb.incrementSessionCounter();
    hb.incrementSessionCounter();

    await hb.tick();
    hb.stop();

    expect(runConsolidationFn).not.toHaveBeenCalled();
  });
});
