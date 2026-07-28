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

const DEFAULT_LOCK_TIMEOUT_MS = 1_000;
const LOCK_RETRY_MS = 25;
/** A lock older than this belonged to a process that died holding it. */
const LOCK_STALE_MS = 10_000;

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
  const lockPath = lockPathFor(resourcePath);
  const deadline = Date.now() + timeoutMs;

  mkdirSync(dirname(resourcePath), { recursive: true, mode: CONFIG_DIR_MODE });
  for (;;) {
    try {
      writeFileSync(lockPath, String(process.pid), { flag: "wx" });
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== "EEXIST") throw error;
      if (isLockStale(lockPath)) {
        try {
          unlinkSync(lockPath);
        } catch {
          // Broken by someone else first; retry.
        }
        continue;
      }
      if (Date.now() >= deadline) throw new StateFileLockError(resourcePath);
      await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
    }
  }

  try {
    return await fn();
  } finally {
    releaseFileLock(lockPath);
  }
}

function acquireFileLock(targetPath: string, timeoutMs: number): string {
  const lockPath = lockPathFor(targetPath);
  const deadline = Date.now() + timeoutMs;

  // Without this the first write into a config directory that does not exist
  // yet fails with ENOENT, which the loop below could not tell apart from
  // contention: it retried for the full timeout and then reported the lock as
  // held by another process.
  mkdirSync(dirname(targetPath), { recursive: true, mode: CONFIG_DIR_MODE });

  for (;;) {
    try {
      // "wx" creates or fails — atomic, with no separate existence check to
      // race against (the flaw NFR-REL-07 describes in maintenance.ts).
      writeFileSync(lockPath, String(process.pid), { flag: "wx" });
      return lockPath;
    } catch (error) {
      // Only "it already exists" is contention. Anything else is a broken
      // directory, and waiting a second to say so helps nobody.
      if ((error as NodeJS.ErrnoException)?.code !== "EEXIST") throw error;
      if (isLockStale(lockPath)) {
        try {
          unlinkSync(lockPath);
        } catch {
          // Someone else broke it first; loop and try to take it.
        }
        continue;
      }
      if (Date.now() >= deadline) throw new StateFileLockError(targetPath);
      sleepSync(LOCK_RETRY_MS);
    }
  }
}

function isLockStale(lockPath: string): boolean {
  try {
    return Date.now() - statSync(lockPath).mtimeMs > LOCK_STALE_MS;
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
  mkdirSync(dir, { recursive: true, mode: CONFIG_DIR_MODE });
  // Same directory, so the rename stays within one filesystem and is atomic.
  const tmp = join(dir, `.${basename(path)}.${process.pid}.${Date.now()}.tmp`);
  try {
    // The mode goes on the temp file, which is the file that ends up in place
    // after the rename. There is no moment at which it exists more permissively.
    writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", {
      encoding: "utf8",
      mode: options?.mode ?? STATE_FILE_MODE,
    });
    renameSync(tmp, path);
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
  const lockPath = acquireFileLock(path, options?.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS);
  try {
    const current = readStateFile<T>(path);
    const next = mutate(current);
    writeStateFile(path, next, options);
    return next;
  } finally {
    releaseFileLock(lockPath);
  }
}
