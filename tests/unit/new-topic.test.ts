// tests/unit/new-topic.test.ts — FR-TOPIC-02/03 transition sequencing and guards.

import { describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";

import { buildClosurePrompt } from "../../backends/closure-prompt";
import { runTopicTransition } from "../../backends/topic-transition";
import { createChatController } from "../../src/lib/chat-controller";
import { isNewTopicDisabled } from "../../src/lib/new-topic-contract";
import {
  clearOneLinerOnTopicTransition,
  createOneLinerSessionState,
  isOneLinerVisible,
  recordOneLinerReceived,
  shouldRequestOneLiner,
} from "../../src/lib/one-liner-session";

function fakeWorker(overrides: Partial<ReturnType<typeof baseWorker>> = {}) {
  return { ...baseWorker(), ...overrides };
}

function baseWorker() {
  return {
    prompt: vi.fn(async () => {}),
    abort: vi.fn(async () => {}),
    resolvePermission: vi.fn(async () => {}),
    dismissDeferredItems: vi.fn(async () => {}),
    shutdown: vi.fn(async () => {}),
    newTopic: vi.fn(async () => {}),
    wrapUp: vi.fn(async () => {}),
  };
}

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

describe("buildClosurePrompt", () => {
  it("returns a non-empty system-framed closure prompt", () => {
    const prompt = buildClosurePrompt();
    expect(prompt.trim().length).toBeGreaterThan(0);
    expect(prompt).toMatch(/^\[System:/);
    expect(prompt).toContain("wrap up");
    expect(prompt).toContain("next action");
  });

  it("does not auto-close the session after the closure turn", () => {
    const prompt = buildClosurePrompt();
    expect(prompt.toLowerCase()).not.toContain("close automatically");
  });

  it("invites the user to discuss before closing", () => {
    const prompt = buildClosurePrompt();
    expect(prompt).toMatch(/discuss|questions|ready/i);
  });
});

describe("wrapUp controller flow", () => {
  it("sets wrappingUp without triggering a topic transition", async () => {
    const worker = fakeWorker();
    const controller = createChatController(worker);

    await controller.wrapUp();

    expect(worker.wrapUp).toHaveBeenCalledOnce();
    expect(worker.newTopic).not.toHaveBeenCalled();
    expect(get(controller.wrappingUp)).toBe(true);
  });

  it("confirmWrapUp triggers newTopic and clears wrappingUp", async () => {
    const worker = fakeWorker();
    const controller = createChatController(worker);

    await controller.wrapUp();
    await controller.confirmWrapUp();

    expect(worker.newTopic).toHaveBeenCalledOnce();
    expect(get(controller.wrappingUp)).toBe(false);
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

describe("one-liner session (FR-ORIENT-04)", () => {
  it("requests one-liner only on first open before any recap was fetched", () => {
    const state = {
      ...createOneLinerSessionState(),
      orientationShownThisSession: true,
    };
    expect(shouldRequestOneLiner(state)).toBe(true);
  });

  it("clears one-liner on topic transition and does not re-request", () => {
    let state = {
      ...createOneLinerSessionState(),
      orientationShownThisSession: true,
    };
    state = recordOneLinerReceived(state, "Worked on orientation card");
    expect(isOneLinerVisible(state.lastOneLiner, null, 0)).toBe(true);

    state = clearOneLinerOnTopicTransition(state);
    expect(state.lastOneLiner).toBe(null);
    expect(isOneLinerVisible(state.lastOneLiner, null, 0)).toBe(false);
    expect(shouldRequestOneLiner(state)).toBe(false);
  });
});
