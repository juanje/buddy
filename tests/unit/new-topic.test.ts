// tests/unit/new-topic.test.ts — FR-TOPIC-02 transition sequencing and guards.

import { describe, expect, it, vi } from "vitest";

import { runTopicTransition } from "../../backends/topic-transition";
import { isNewTopicDisabled } from "../../src/lib/new-topic-contract";

describe("runTopicTransition", () => {
  it("is a no-op when there is no active core", async () => {
    const shutdownCore = vi.fn(async () => {});
    const startSession = vi.fn(async () => {});

    await runTopicTransition({
      hasCore: () => false,
      shutdownCore,
      stopHeartbeat: vi.fn(),
      disposeCore: vi.fn(),
      clearCoreRef: vi.fn(),
      onTransitionStart: vi.fn(),
      startSession,
      rootDir: "/tmp/buddy",
    });

    expect(shutdownCore).not.toHaveBeenCalled();
    expect(startSession).not.toHaveBeenCalled();
  });

  it("shuts down before starting a fresh session", async () => {
    const order: string[] = [];
    const shutdownCore = vi.fn(async () => {
      order.push("shutdown");
    });
    const stopHeartbeat = vi.fn(() => {
      order.push("stopHeartbeat");
    });
    const disposeCore = vi.fn(() => {
      order.push("dispose");
    });
    const clearCoreRef = vi.fn(() => {
      order.push("clearCore");
    });
    const onTransitionStart = vi.fn(() => {
      order.push("onTransitionStart");
    });
    const startSession = vi.fn(async () => {
      order.push("startSession");
    });

    await runTopicTransition({
      hasCore: () => true,
      shutdownCore,
      stopHeartbeat,
      disposeCore,
      clearCoreRef,
      onTransitionStart,
      startSession,
      rootDir: "/tmp/buddy",
    });

    expect(order).toEqual([
      "shutdown",
      "stopHeartbeat",
      "dispose",
      "clearCore",
      "onTransitionStart",
      "startSession",
    ]);
    expect(startSession).toHaveBeenCalledWith("/tmp/buddy");
  });

  it("calls onTransitionStart before startSession", async () => {
    const onTransitionStart = vi.fn();
    const startSession = vi.fn(async () => {});

    await runTopicTransition({
      hasCore: () => true,
      shutdownCore: vi.fn(async () => {}),
      stopHeartbeat: vi.fn(),
      disposeCore: vi.fn(),
      clearCoreRef: vi.fn(),
      onTransitionStart,
      startSession,
      rootDir: "/buddy",
    });

    expect(onTransitionStart.mock.invocationCallOrder[0]).toBeLessThan(
      startSession.mock.invocationCallOrder[0],
    );
  });
});

describe("isNewTopicDisabled", () => {
  it("is disabled while streaming", () => {
    expect(isNewTopicDisabled(true, false)).toBe(true);
  });

  it("is disabled during transition", () => {
    expect(isNewTopicDisabled(false, true)).toBe(true);
  });

  it("is enabled when idle", () => {
    expect(isNewTopicDisabled(false, false)).toBe(false);
  });
});
