// tests/unit/reflect-recovery.test.ts — crash recovery spawn guard + cap.

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { findPendingReflects, parseFrontmatter, savePendingSkeleton } from "../../backends/reflect";
import { runCrashRecoveryCatchUp } from "../../backends/reflect-recovery";
import type { SpawnReflectOptions } from "../../backends/reflect-spawn";
import { SessionTracker } from "../../backends/session-tracker";
import {
  CRASH_RECOVERY_MAX,
  REFLECT_CHILD_ENV_KEY,
  REFLECT_CHILD_ENV_VALUE,
} from "../../shared/defaults";
import { MOCK_SPAWN_PID } from "../support/test-constants";

describe("runCrashRecoveryCatchUp", () => {
  let dir: string;
  const savedEnv = process.env[REFLECT_CHILD_ENV_KEY];

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    if (savedEnv === undefined) {
      delete process.env[REFLECT_CHILD_ENV_KEY];
    } else {
      process.env[REFLECT_CHILD_ENV_KEY] = savedEnv;
    }
  });

  function savePending(sessionId: string): string {
    const tracker = new SessionTracker(sessionId);
    tracker.filesWritten.push("user/inbox.md");
    return savePendingSkeleton(dir, tracker.toSnapshot());
  }

  it("returns empty when AB_REFLECT_CHILD is set (recursion guard)", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-recovery-"));
    savePending("pending-guard");
    process.env[REFLECT_CHILD_ENV_KEY] = REFLECT_CHILD_ENV_VALUE;

    const spawned = runCrashRecoveryCatchUp(dir, () => MOCK_SPAWN_PID);

    expect(spawned).toEqual([]);
  });

  it("marks pending skeleton as reflect-in-progress before spawn", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-recovery-"));
    const path = savePending("pending-mark");

    runCrashRecoveryCatchUp(dir, () => MOCK_SPAWN_PID);

    const content = readFileSync(path, "utf8");
    expect(parseFrontmatter(content).status).toBe("reflect-in-progress");
  });

  it("caps spawns at CRASH_RECOVERY_MAX", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-recovery-"));
    for (let i = 0; i < 5; i++) {
      savePending(`pending-${i}`);
    }

    const spawn = vi.fn(() => MOCK_SPAWN_PID);
    const spawned = runCrashRecoveryCatchUp(dir, spawn);

    expect(spawn).toHaveBeenCalledTimes(CRASH_RECOVERY_MAX);
    expect(spawned).toHaveLength(CRASH_RECOVERY_MAX);
  });

  it("spawns crash-catchup for each pending skeleton up to the cap", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-recovery-"));
    savePending("pending-happy");

    const spawnCalls: SpawnReflectOptions[] = [];
    runCrashRecoveryCatchUp(dir, (options) => {
      spawnCalls.push(options);
      return MOCK_SPAWN_PID;
    });

    expect(spawnCalls).toHaveLength(1);
    expect(spawnCalls[0]).toMatchObject({
      rootDir: dir,
      forkedSessionFile: "",
      mode: "crash-catchup",
    });
    expect(spawnCalls[0].logPath).toMatch(/\.buddy\/pending\/pending-happy\.md$/);
    expect(findPendingReflects(dir)).toHaveLength(0);
  });
});
