// backends/maintenance.ts — Lock management for reflect and consolidation (FR-REFLECT-02).

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { LOCK_STALE_MS } from "../shared/defaults";

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

export function acquireLock(rootDir: string): boolean {
  if (!isLockStale(rootDir)) return false;
  if (existsSync(lockPath(rootDir))) {
    try {
      unlinkSync(lockPath(rootDir));
    } catch {
      return false;
    }
  }
  const payload: MaintenanceLock = { pid: process.pid, timestamp: new Date().toISOString() };
  const path = lockPath(rootDir);
  mkdirSync(join(rootDir, ".buddy"), { recursive: true });
  writeFileSync(path, JSON.stringify(payload), "utf8");
  return true;
}

export function releaseLock(rootDir: string): void {
  const path = lockPath(rootDir);
  if (existsSync(path)) unlinkSync(path);
}
