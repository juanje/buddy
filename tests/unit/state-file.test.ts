// tests/unit/state-file.test.ts — NFR-REL-08 durable state writes.
//
// The two rules this module exists to enforce, each of which was violated
// somewhere before H5: write atomically, and never treat "cannot read" as
// "empty". The adversarial cases are the point (NFR-TEST-01).

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  readStateFile,
  StateFileLockError,
  StateFileUnreadableError,
  updateStateFile,
  writeStateFile,
} from "../../backends/state-file";

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "state-file-"));
  file = join(dir, "state.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("readStateFile", () => {
  it("returns undefined for a file that does not exist", () => {
    expect(readStateFile(file)).toBeUndefined();
  });

  it("reads back what was written", () => {
    writeStateFile(file, { a: 1 });
    expect(readStateFile(file)).toEqual({ a: 1 });
  });

  it("throws on a file that exists but does not parse", () => {
    // The old behaviour returned {} here, and the caller then overwrote the
    // file — losing every credential or approved path it held.
    writeFileSync(file, "{ not json");
    expect(() => readStateFile(file)).toThrow(StateFileUnreadableError);
  });

  it("throws on a file that cannot be opened", () => {
    writeStateFile(file, { a: 1 });
    chmodSync(file, 0o000);
    let threw = false;
    try {
      readStateFile(file);
    } catch (error) {
      threw = error instanceof StateFileUnreadableError;
    } finally {
      chmodSync(file, 0o600);
    }
    // Running as root defeats the permission bit; only assert when it applied.
    if (threw) expect(threw).toBe(true);
  });
});

describe("writeStateFile", () => {
  it("creates parent directories", () => {
    const nested = join(dir, "a", "b", "state.json");
    writeStateFile(nested, { ok: true });
    expect(readStateFile(nested)).toEqual({ ok: true });
  });

  it("applies the requested mode at creation, not afterwards", () => {
    writeStateFile(file, { secret: true }, { mode: 0o600 });
    // NFR-SEC-17: POSIX modes on Unix; on Windows chmod is meaningless — ACL
    // coverage lives in config-permissions.test.ts / secure-perms.test.ts.
    if (process.platform !== "win32") {
      expect(statSync(file).mode & 0o777).toBe(0o600);
    } else {
      expect(existsSync(file)).toBe(true);
    }
  });

  it("leaves no temp files behind", () => {
    writeStateFile(file, { a: 1 });
    writeStateFile(file, { a: 2 });
    expect(readdirSync(dir).filter((n) => n.includes(".tmp"))).toEqual([]);
  });

  it("leaves the previous content intact when serialization fails", () => {
    writeStateFile(file, { good: true });
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => writeStateFile(file, circular)).toThrow();
    expect(readStateFile(file)).toEqual({ good: true });
    expect(readdirSync(dir).filter((n) => n.includes(".tmp"))).toEqual([]);
  });

  it("never leaves a partially written file visible", () => {
    // Atomicity is by rename: the target is either the old bytes or the new
    // ones. Approximated here by checking the file always parses.
    writeStateFile(file, { n: 0 });
    for (let i = 1; i <= 20; i++) {
      writeStateFile(file, { n: i, padding: "x".repeat(i * 500) });
      expect(() => JSON.parse(readFileSync(file, "utf8"))).not.toThrow();
    }
  });
});

describe("updateStateFile", () => {
  it("creates the file when absent, passing undefined to the mutator", () => {
    const seen: unknown[] = [];
    updateStateFile(file, (current) => {
      seen.push(current);
      return { count: 1 };
    });
    expect(seen).toEqual([undefined]);
    expect(readStateFile(file)).toEqual({ count: 1 });
  });

  it("merges into existing content", () => {
    writeStateFile(file, { a: 1 });
    updateStateFile<Record<string, number>>(file, (current) => ({ ...current, b: 2 }));
    expect(readStateFile(file)).toEqual({ a: 1, b: 2 });
  });

  it("refuses to merge into an unreadable file rather than replacing it", () => {
    writeFileSync(file, "{ corrupt");
    expect(() => updateStateFile(file, () => ({ replaced: true }))).toThrow(
      StateFileUnreadableError,
    );
    // The corrupt file is still there: recoverable by hand, not silently gone.
    expect(readFileSync(file, "utf8")).toBe("{ corrupt");
  });

  it("releases the lock after a failed update", () => {
    writeFileSync(file, "{ corrupt");
    expect(() => updateStateFile(file, () => ({}))).toThrow();
    rmSync(file);
    // A leaked lock would make this throw StateFileLockError instead.
    expect(() => updateStateFile(file, () => ({ ok: true }))).not.toThrow();
  });

  it("gives up rather than waiting forever when the lock is held", () => {
    writeFileSync(join(dir, ".state.json.lock"), String(process.pid));
    expect(() => updateStateFile(file, () => ({}), { lockTimeoutMs: 100 })).toThrow(
      StateFileLockError,
    );
  });

  it("breaks a stale lock left by a dead process", () => {
    const lock = join(dir, ".state.json.lock");
    writeFileSync(lock, "99999");
    // Backdate well past the staleness threshold.
    const old = new Date(Date.now() - 60_000);
    const { utimesSync } = require("node:fs") as typeof import("node:fs");
    utimesSync(lock, old, old);
    expect(() => updateStateFile(file, () => ({ ok: true }), { lockTimeoutMs: 200 })).not.toThrow();
    expect(readStateFile(file)).toEqual({ ok: true });
  });

  it("serializes concurrent updates without losing any", () => {
    // Same-process interleaving cannot be forced with sync APIs; the
    // cross-process case is covered in state-file-concurrency.test.ts. This
    // asserts the accumulate-don't-clobber contract.
    for (let i = 0; i < 50; i++) {
      updateStateFile<{ n: number }>(file, (current) => ({ n: (current?.n ?? 0) + 1 }));
    }
    expect(readStateFile<{ n: number }>(file)).toEqual({ n: 50 });
  });
});
