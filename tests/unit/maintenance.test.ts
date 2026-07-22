// tests/unit/maintenance.test.ts — FR-REFLECT-02 lock management.

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { acquireLock, isLockStale, lockPath, releaseLock } from "../../backends/maintenance";

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
