// tests/unit/maintenance.test.ts — FR-REFLECT-02 lock + catch-up.

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { simpleGit } from "simple-git";

import {
  acquireLock,
  isLockStale,
  lockPath,
  releaseLock,
  runCatchUpReflects,
} from "../../backends/maintenance";
import { saveSessionSkeleton } from "../../backends/reflect";
import { SessionTracker } from "../../backends/session-tracker";

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
    const git = simpleGit(dir);
    await git.init();
    await git.addConfig("user.name", "AB");
    await git.addConfig("user.email", "ab@localhost");
    const tracker = new SessionTracker("sess1");
    saveSessionSkeleton(dir, tracker.toSnapshot());
    const processed = await runCatchUpReflects(dir, {
      encodeReflect: async () => "### Context\nEncoded.",
    });
    expect(processed).toHaveLength(1);
  });
});
