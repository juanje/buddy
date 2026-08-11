// backends/state-file.ts — Durable writes for the JSON state under ~/.buddy/ (NFR-REL-08).
//
// Four files were each doing this differently. `usage.json` and
// `allowed-paths.json` wrote atomically; `auth.json` and `config.json` wrote in
// place — so the least important file was the best protected and the one
// holding credentials was not. Worse, `auth.json` and `allowed-paths.json` both
// treated "cannot read" as "empty", so a corrupt or transiently unreadable file
// was replaced by whatever was being written: every configured provider gone,
// every approved path gone.
//
// Two rules, one implementation:
//   1. Write via a temp file in the same directory, then rename. A rename
//      within a filesystem is atomic, so a reader sees the old file or the new
//      one, never a truncated one.
//   2. A file that exists but cannot be read is an error, never an empty
//      object. Callers decide what to do; none of them may overwrite it.
//
// Read-modify-write additionally takes a cross-process lock, because the reflect
// child is a separate process writing the same usage file as the worker
// (NFR-REL-06).

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";

import { CONFIG_DIR_MODE, STATE_FILE_MODE } from "../shared/defaults";
import { applyRestrictiveAcl } from "./secure-perms";

/** The file exists but could not be read or parsed. Never overwrite on this. */
export class StateFileUnreadableError extends Error {
  constructor(
    readonly path: string,
    readonly cause: unknown,
  ) {
    super(`State file exists but could not be read: ${path}`);
    this.name = "StateFileUnreadableError";
  }
}

/** Could not take the write lock in time — another process is holding it. */
export class StateFileLockError extends Error {
  constructor(readonly path: string) {
    super(`Could not acquire the write lock for: ${path}`);
    this.name = "StateFileLockError";
  }
}

export interface StateFileOptions {
  /**
   * File mode for the written file. Applied at creation, not afterwards.
   * Defaults to `STATE_FILE_MODE` — every file this module writes lives in
   * ~/.buddy/ and none of them is anyone else's business (NFR-SEC-17).
   */
  mode?: number;
  /** How long to wait for the lock before giving up. */
  lockTimeoutMs?: number;
}

// Deliberately named apart from `LOCK_RETRY_MS`/`LOCK_STALE_MS` in
// shared/defaults.ts, which belong to the *maintenance* lock and differ by a
// factor of 360 (500ms/1h there, 25ms/10s here). They are not the same knob:
// that lock guards a consolidation run that makes LLM calls and may legitimately
// hold for an hour, while this one guards a read-modify-write of a small JSON
// file and must not be held for longer than that takes. Two same-named
// constants with wildly different values, one of them "centralized", was a
// reader's trap. These stay local because they are an implementation detail of
// this module, not an operational default anyone should tune (NFR-CONFIG-01).
const STATE_LOCK_TIMEOUT_MS = 1_000;
const STATE_LOCK_RETRY_MS = 25;
/** A lock older than this belonged to a process that died holding it. */
const STATE_LOCK_STALE_MS = 10_000;

// Synchronous wait: these helpers are sync because every caller is, and making
// them async would ripple into the Pi event subscription. Contention is rare
// and the budget is under a second.
const sleepBuffer = new Int32Array(new SharedArrayBuffer(4));
function sleepSync(ms: number): void {
  Atomics.wait(sleepBuffer, 0, 0, ms);
}

function lockPathFor(targetPath: string): string {
  return join(dirname(targetPath), `.${basename(targetPath)}.lock`);
}

/**
 * Prepare to lock `resourcePath` and return the lock file's path.
 *
 * The mkdir is not incidental: without it the first write into a config
 * directory that does not exist yet fails with ENOENT, which the acquisition
 * loop cannot tell apart from contention — it retried for the full timeout and
 * then reported the lock as held by another process.
 */
function beginLock(resourcePath: string): string {
  mkdirSync(dirname(resourcePath), { recursive: true, mode: CONFIG_DIR_MODE });
  return lockPathFor(resourcePath);
}

/**
 * One attempt at the lock. The caller does the waiting, which is the only thing
 * the sync and async variants ever disagreed about — everything else here was
 * written out twice, and only one of the two copies carried the reasoning.
 *
 * - `taken` — the lock is ours.
 * - `retry` — a dead holder's lock was broken; try again **without** waiting.
 * - `wait`  — a live holder; back off, then try again.
 */
function tryTakeLock(
  lockPath: string,
  resourcePath: string,
  deadline: number,
): "taken" | "retry" | "wait" {
  try {
    // "wx" creates or fails — atomic, with no separate existence check to
    // race against (the flaw NFR-REL-07 describes in maintenance.ts).
    writeFileSync(lockPath, String(process.pid), { flag: "wx" });
    return "taken";
  } catch (error) {
    // Only "it already exists" is contention. Anything else is a broken
    // directory, and waiting a second to say so helps nobody.
    if ((error as NodeJS.ErrnoException)?.code !== "EEXIST") throw error;
    if (isLockStale(lockPath)) {
      try {
        unlinkSync(lockPath);
      } catch {
        // Someone else broke it first; the next attempt decides the winner.
      }
      return "retry";
    }
    if (Date.now() >= deadline) throw new StateFileLockError(resourcePath);
    return "wait";
  }
}

/**
 * Run `fn` while holding an exclusive cross-process lock on `resourcePath`.
 *
 * Async variant: waits without blocking the event loop, so it is safe to hold
 * across slow operations. Used to serialize git access between the worker, the
 * consolidation run and the reflect child (FR-REFLECT-06) — `resourcePath` need
 * not be a file that exists, only a stable name to lock on.
 */
export async function withFileLock<T>(
  resourcePath: string,
  fn: () => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const lockPath = beginLock(resourcePath);
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const attempt = tryTakeLock(lockPath, resourcePath, deadline);
    if (attempt === "taken") break;
    if (attempt === "wait") {
      await new Promise((resolve) => setTimeout(resolve, STATE_LOCK_RETRY_MS));
    }
  }

  try {
    return await fn();
  } finally {
    releaseFileLock(lockPath);
  }
}

function acquireFileLock(targetPath: string, timeoutMs: number): string {
  const lockPath = beginLock(targetPath);
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const attempt = tryTakeLock(lockPath, targetPath, deadline);
    if (attempt === "taken") return lockPath;
    if (attempt === "wait") sleepSync(STATE_LOCK_RETRY_MS);
  }
}

function isLockStale(lockPath: string): boolean {
  try {
    return Date.now() - statSync(lockPath).mtimeMs > STATE_LOCK_STALE_MS;
  } catch {
    return false; // vanished between the failed create and this check
  }
}

function releaseFileLock(lockPath: string): void {
  try {
    rmSync(lockPath, { force: true });
  } catch {
    // Best effort: a stale lock is broken by the next writer.
  }
}

/**
 * Read a JSON state file. Returns undefined only when the file is genuinely
 * absent; throws when it exists but cannot be read, so no caller can mistake
 * corruption for emptiness.
 */
export function readStateFile<T>(path: string): T | undefined {
  if (!existsSync(path)) return undefined;
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (error) {
    throw new StateFileUnreadableError(path, error);
  }
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new StateFileUnreadableError(path, error);
  }
}

/** Write JSON atomically: temp file in the same directory, then rename. */
export function writeStateFile(path: string, data: unknown, options?: StateFileOptions): void {
  const dir = dirname(path);
  const dirExisted = existsSync(dir);
  mkdirSync(dir, { recursive: true, mode: CONFIG_DIR_MODE });
  // NFR-SEC-17 on Windows: ACL the directory when we create it; the file after
  // rename. Avoid icacls on the temp name (rename preserves the ACL).
  if (!dirExisted) applyRestrictiveAcl(dir);
  // Same directory, so the rename stays within one filesystem and is atomic.
  const tmp = join(dir, `.${basename(path)}.${process.pid}.${Date.now()}.tmp`);
  // NFR-SEC-17 / review B1: ACL only on first create. Later writes inherit the
  // parent directory ACL (already restricted above); spawning icacls on every
  // usage.json rewrite is pure overhead (NFR-PORT-09).
  const fileExisted = existsSync(path);
  try {
    // The mode goes on the temp file, which is the file that ends up in place
    // after the rename. There is no moment at which it exists more permissively.
    writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", {
      encoding: "utf8",
      mode: options?.mode ?? STATE_FILE_MODE,
    });
    renameSync(tmp, path);
    if (!fileExisted) applyRestrictiveAcl(path);
  } catch (error) {
    try {
      rmSync(tmp, { force: true });
    } catch {
      // Nothing more to do; the target is untouched either way.
    }
    throw error;
  }
}

/**
 * Read, transform and write back under a cross-process lock.
 *
 * Throws `StateFileUnreadableError` if the file exists but cannot be parsed —
 * merging into an unknown state would destroy it. Throws `StateFileLockError`
 * if another process holds the lock for too long.
 */
export function updateStateFile<T>(
  path: string,
  mutate: (current: T | undefined) => T,
  options?: StateFileOptions,
): T {
  const lockPath = acquireFileLock(path, options?.lockTimeoutMs ?? STATE_LOCK_TIMEOUT_MS);
  try {
    const current = readStateFile<T>(path);
    const next = mutate(current);
    writeStateFile(path, next, options);
    return next;
  } finally {
    releaseFileLock(lockPath);
  }
}
