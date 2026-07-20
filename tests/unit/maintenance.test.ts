// tests/unit/maintenance.test.ts — FR-REFLECT-02 lock + catch-up.

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  acquireLock,
  isLockStale,
  lockPath,
  releaseLock,
  runCatchUpReflects,
} from "../../backends/maintenance";
import { findPendingReflects, savePendingSkeleton } from "../../backends/reflect";
import { SessionTracker } from "../../backends/session-tracker";
import { initTestGitRepo } from "../support/test-git";

describe("maintenance lock", () => {
  let dir: string;

  afterEach(() => {
    if (dir) {
      releaseLock(dir);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("acquires and releases lock", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-lock-"));
    expect(acquireLock(dir)).toBe(true);
    expect(existsSync(lockPath(dir))).toBe(true);
    expect(acquireLock(dir)).toBe(false);
    releaseLock(dir);
    expect(existsSync(lockPath(dir))).toBe(false);
  });

  it("treats missing lock as stale", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-lock-"));
    expect(isLockStale(dir)).toBe(true);
  });
});

describe("runCatchUpReflects", () => {
  let dir: string;

  afterEach(() => {
    if (dir) {
      releaseLock(dir);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("processes pending reflects", async () => {
    dir = mkdtempSync(join(tmpdir(), "ab-catchup-"));
    await initTestGitRepo(dir);
    const tracker = new SessionTracker("sess1");
    savePendingSkeleton(dir, tracker.toSnapshot());
    const processed = await runCatchUpReflects(dir, {
      encodeReflect: async () => "### Context\nEncoded.",
    });
    expect(processed).toHaveLength(1);
    expect(findPendingReflects(dir)).toHaveLength(0);
  });
});
