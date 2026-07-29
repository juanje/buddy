// tests/unit/crash-recovery.test.ts — FR-REFLECT-05 session persistence + crash recovery.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  clearSessionPersistence,
  markReflectPending,
  persistLiveSession,
  recoverStaleSession,
} from "../../backends/crash-recovery";
import type { SpawnReflectOptions } from "../../backends/reflect-spawn";
import { loadConsolidationState } from "../../shared/consolidation-state";

describe("crash recovery", () => {
  let dir: string;
  const spawns: SpawnReflectOptions[] = [];

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    spawns.length = 0;
  });

  it("persists live session path and clears reflectPending", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-crash-"));
    persistLiveSession(dir, "/tmp/session-abc.jsonl");

    const state = loadConsolidationState(dir);
    expect(state.liveSessionFile).toBe("/tmp/session-abc.jsonl");
    expect(state.reflectPending).toBe(false);
  });

  it("marks reflect pending on shutdown", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-crash-"));
    persistLiveSession(dir, "/tmp/session-abc.jsonl");
    markReflectPending(dir);

    const state = loadConsolidationState(dir);
    expect(state.reflectPending).toBe(true);
    expect(state.liveSessionFile).toBe("/tmp/session-abc.jsonl");
  });

  it("recovers stale session on boot and clears state", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-crash-"));
    persistLiveSession(dir, "/tmp/session-old.jsonl");
    markReflectPending(dir);

    const recovered = recoverStaleSession(dir, (options) => {
      spawns.push(options);
      return 1;
    });

    expect(recovered).toBe(true);
    expect(spawns).toHaveLength(1);
    expect(spawns[0].mode).toBe("session-end");
    expect(spawns[0].forkedSessionFile).toBe("/tmp/session-old.jsonl");

    const state = loadConsolidationState(dir);
    expect(state.reflectPending).toBe(false);
    expect(state.liveSessionFile).toBeNull();
  });

  it("skips recovery when reflectPending is false", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-crash-"));
    persistLiveSession(dir, "/tmp/session-old.jsonl");

    const recovered = recoverStaleSession(dir, (options) => {
      spawns.push(options);
      return 1;
    });

    expect(recovered).toBe(false);
    expect(spawns).toHaveLength(0);
  });

  it("clearSessionPersistence resets fields", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-crash-"));
    persistLiveSession(dir, "/tmp/session-old.jsonl");
    markReflectPending(dir);
    clearSessionPersistence(dir);

    const state = loadConsolidationState(dir);
    expect(state.reflectPending).toBe(false);
    expect(state.liveSessionFile).toBeNull();
  });
});
