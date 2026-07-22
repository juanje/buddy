// backends/maintenance.ts — Lock management for reflect and consolidation (FR-REFLECT-02).

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { LOCK_STALE_MS } from "../shared/defaults";

export interface MaintenanceLock {
  pid: number;
  timestamp: string;
}

export function lockPath(abDirectory: string): string {
  return join(abDirectory, ".buddy", "maintenance.lock");
}

function readLock(abDirectory: string): MaintenanceLock | null {
  const path = lockPath(abDirectory);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as MaintenanceLock;
  } catch {
    return null;
  }
}

export function isLockStale(abDirectory: string, now = Date.now()): boolean {
  const lock = readLock(abDirectory);
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

export function acquireLock(abDirectory: string): boolean {
  if (!isLockStale(abDirectory)) return false;
  if (existsSync(lockPath(abDirectory))) {
    try {
      unlinkSync(lockPath(abDirectory));
    } catch {
      return false;
    }
  }
  const payload: MaintenanceLock = { pid: process.pid, timestamp: new Date().toISOString() };
  const path = lockPath(abDirectory);
  mkdirSync(join(abDirectory, ".buddy"), { recursive: true });
  writeFileSync(path, JSON.stringify(payload), "utf8");
  return true;
}

export function releaseLock(abDirectory: string): void {
  const path = lockPath(abDirectory);
  if (existsSync(path)) unlinkSync(path);
}
