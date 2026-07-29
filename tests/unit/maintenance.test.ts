// tests/unit/maintenance.test.ts — FR-REFLECT-02 lock management.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
    dir = mkdtempSync(join(tmpdir(), "buddy-lock-"));
    expect(acquireLock(dir)).toBe(true);
    expect(existsSync(lockPath(dir))).toBe(true);
    expect(acquireLock(dir)).toBe(false);
    releaseLock(dir);
    expect(existsSync(lockPath(dir))).toBe(false);
  });

  it("treats missing lock as stale", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-lock-"));
    expect(isLockStale(dir)).toBe(true);
  });

  // NFR-REL-07. The lock is what keeps two consolidation runs off the same
  // brain, so "who holds it" has to have exactly one answer.
  it("takes over a lock whose holder is gone", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-lock-"));
    mkdirSync(join(dir, ".buddy"), { recursive: true });
    // A pid that cannot be running: process.kill(pid, 0) fails, so the lock is
    // stale however recent its timestamp.
    writeFileSync(
      lockPath(dir),
      JSON.stringify({ pid: 0x7ffffff0, timestamp: new Date().toISOString() }),
      "utf8",
    );

    expect(acquireLock(dir)).toBe(true);
    expect(JSON.parse(readFileSync(lockPath(dir), "utf8")).pid).toBe(process.pid);
  });

  it("refuses a lock held by a live process, however it is asked", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-lock-"));
    expect(acquireLock(dir)).toBe(true);
    // Repeatedly, because the failure this guards against is a race: the old
    // implementation's check-then-unlink-then-write let two callers both
    // conclude the lock was theirs.
    for (let i = 0; i < 5; i++) expect(acquireLock(dir)).toBe(false);
    expect(JSON.parse(readFileSync(lockPath(dir), "utf8")).pid).toBe(process.pid);
  });

  it("does not leave a lock behind when it fails to take one", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-lock-"));
    acquireLock(dir);
    const held = readFileSync(lockPath(dir), "utf8");
    acquireLock(dir);
    expect(readFileSync(lockPath(dir), "utf8")).toBe(held);
  });
});
