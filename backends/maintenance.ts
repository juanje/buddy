// backends/maintenance.ts — Lock management for reflect and consolidation (FR-REFLECT-02).

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { LOCK_STALE_MS } from "../shared/defaults";
import { toLocalIsoStamp } from "../shared/dates";

export interface MaintenanceLock {
  pid: number;
  timestamp: string;
}

export function lockPath(rootDir: string): string {
  return join(rootDir, ".buddy", "maintenance.lock");
}

function readLock(rootDir: string): MaintenanceLock | null {
  const path = lockPath(rootDir);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as MaintenanceLock;
  } catch {
    return null;
  }
}

export function isLockStale(rootDir: string, now = Date.now()): boolean {
  const lock = readLock(rootDir);
  if (!lock) return true;
  const age = now - Date.parse(lock.timestamp);
  if (Number.isNaN(age) || age > LOCK_STALE_MS) return true;
  try {
    process.kill(lock.pid, 0);
    return false;
  } catch {
    return true;
  }
}

/**
 * Take the maintenance lock, or report that someone else holds it (NFR-REL-07).
 *
 * The acquisition is a single `wx` write: the file is created or the call
 * fails, with no window in between. The previous version checked staleness,
 * then checked existence, then unlinked, then wrote — four steps during which
 * a second process running the same four steps would reach the same
 * conclusions. Both would return true, and both would run consolidation over
 * the same brain at the same time.
 *
 * Breaking a stale lock keeps that property. Two processes may both decide the
 * lock is dead and both unlink it, but only one of them can then create it.
 */
export function acquireLock(rootDir: string): boolean {
  const path = lockPath(rootDir);
  mkdirSync(join(rootDir, ".buddy"), { recursive: true });

  const payload: MaintenanceLock = { pid: process.pid, timestamp: toLocalIsoStamp(new Date()) };
  const write = () => writeFileSync(path, JSON.stringify(payload), { encoding: "utf8", flag: "wx" });

  try {
    write();
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== "EEXIST") return false;
  }

  // It exists. Only a dead or expired holder may be displaced.
  if (!isLockStale(rootDir)) return false;
  try {
    unlinkSync(path);
  } catch {
    // Someone else broke it first; the create below still decides the winner.
  }

  try {
    write();
    return true;
  } catch {
    return false; // lost the race to whoever broke it alongside us
  }
}

export function releaseLock(rootDir: string): void {
  const path = lockPath(rootDir);
  if (existsSync(path)) unlinkSync(path);
}
