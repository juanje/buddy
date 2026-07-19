// backends/maintenance.ts — Catch-up reflect + lock management (FR-REFLECT-02).

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { commitAll } from "./git";
import { findPendingReflects, markReflectComplete } from "./reflect";

export interface MaintenanceLock {
  pid: number;
  timestamp: string;
}

export interface CatchUpOptions {
  /** Max pending logs to process per run (default 3). */
  max?: number;
  /** Inject LLM encoding for tests; real worker passes Pi maintenance session. */
  encodeReflect?: (logPath: string, skeleton: string) => Promise<string>;
}

const STALE_MS = 60 * 60 * 1000;

export function lockPath(abDirectory: string): string {
  return join(abDirectory, ".ab-app", "maintenance.lock");
}

export function readLock(abDirectory: string): MaintenanceLock | null {
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
  if (Number.isNaN(age) || age > STALE_MS) return true;
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
  mkdirSync(join(abDirectory, ".ab-app"), { recursive: true });
  writeFileSync(path, JSON.stringify(payload), "utf8");
  return true;
}

export function releaseLock(abDirectory: string): void {
  const path = lockPath(abDirectory);
  if (existsSync(path)) unlinkSync(path);
}

export async function runCatchUpReflects(
  abDirectory: string,
  options: CatchUpOptions = {},
): Promise<string[]> {
  const pending = findPendingReflects(abDirectory);
  if (pending.length === 0) return [];

  if (!acquireLock(abDirectory)) return [];

  const processed: string[] = [];
  try {
    const max = options.max ?? 3;
    for (const item of pending.slice(0, max)) {
      const skeleton = readFileSync(item.path, "utf8");
      const encoded = options.encodeReflect
        ? await options.encodeReflect(item.path, skeleton)
        : defaultReflectSummary(skeleton);
      markReflectComplete(item.path, encoded);
      processed.push(item.path);
    }
    await commitAll(abDirectory, "ab: catch-up reflect");
  } finally {
    releaseLock(abDirectory);
  }
  return processed;
}

function defaultReflectSummary(skeleton: string): string {
  const hasWrites = skeleton.includes("## Files written") && !skeleton.includes("(none)");
  const hasReads = skeleton.includes("## Files read") && !skeleton.match(/## Files read\n\(none\)/);
  const lines = ["### Context", "Session activity captured in factual skeleton."];
  if (hasWrites) lines.push("- Agent wrote files during the session.");
  if (hasReads) lines.push("- Agent read context files during the session.");
  lines.push("", "### Open threads", "- (none recorded in skeleton)");
  return lines.join("\n");
}
