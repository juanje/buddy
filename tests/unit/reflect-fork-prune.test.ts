// tests/unit/reflect-fork-prune.test.ts — NFR-MAINT-02.
//
// Nothing pruned .buddy/reflect-sessions/ before H6. One fork per session and
// per checkpoint, each holding the full conversation transcript in plain text,
// kept for the life of the install.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  pruneLiveSessions,
  pruneReflectForks,
  pruneSessionArtifacts,
  pruneSessionLogs,
} from "../../backends/session-log-prune";
import { APP_LOGS_DIR, REFLECT_SESSIONS_DIR, SESSIONS_DIR } from "../../shared/defaults";
import { MS_PER_DAY } from "../../shared/dates";

let root: string;
const NOW = Date.parse("2026-07-27T12:00:00Z");

function makeFile(dir: string, name: string, ageDays: number): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeFileSync(path, '{"type":"session"}\n', "utf8");
  const when = new Date(NOW - ageDays * MS_PER_DAY);
  utimesSync(path, when, when);
  return path;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "fork-prune-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("pruneReflectForks", () => {
  const forkDir = () => join(root, REFLECT_SESSIONS_DIR);

  it("removes forks older than the retention window", () => {
    makeFile(forkDir(), "old.jsonl", 30);
    makeFile(forkDir(), "recent.jsonl", 1);

    expect(pruneReflectForks(root, 7, NOW)).toBe(1);
    expect(readdirSync(forkDir())).toEqual(["recent.jsonl"]);
  });

  it("keeps the recovery window intact", () => {
    // NFR-REL-02 keeps forks so a failed reflect can be recovered by hand.
    makeFile(forkDir(), "yesterday.jsonl", 1);
    makeFile(forkDir(), "six-days.jsonl", 6);

    expect(pruneReflectForks(root, 7, NOW)).toBe(0);
    expect(readdirSync(forkDir()).sort()).toEqual(["six-days.jsonl", "yesterday.jsonl"]);
  });

  it("ignores files that are not session forks", () => {
    makeFile(forkDir(), "old.jsonl", 30);
    makeFile(forkDir(), "notes.txt", 30);

    pruneReflectForks(root, 7, NOW);
    expect(readdirSync(forkDir())).toEqual(["notes.txt"]);
  });

  it("does nothing when the directory has never been created", () => {
    expect(pruneReflectForks(root, 7, NOW)).toBe(0);
  });
});

describe("pruneLiveSessions", () => {
  const liveDir = () => join(root, SESSIONS_DIR);

  it("removes live sessions older than the retention window", () => {
    makeFile(liveDir(), "old.jsonl", 30);
    makeFile(liveDir(), "recent.jsonl", 1);

    expect(pruneLiveSessions(root, 7, NOW)).toBe(1);
    expect(readdirSync(liveDir())).toEqual(["recent.jsonl"]);
  });

  it("does nothing when the directory has never been created", () => {
    expect(pruneLiveSessions(root, 7, NOW)).toBe(0);
  });
});

describe("pruneSessionArtifacts", () => {
  it("prunes event logs, live sessions, and forks in one pass", () => {
    // The regression that motivated NFR-MAINT-02: only the first of these two
    // directories was ever swept.
    makeFile(join(root, APP_LOGS_DIR), "old.jsonl", 30);
    makeFile(join(root, SESSIONS_DIR), "old.jsonl", 30);
    makeFile(join(root, REFLECT_SESSIONS_DIR), "old.jsonl", 30);

    expect(pruneSessionArtifacts(root, NOW)).toBe(3);
    expect(readdirSync(join(root, APP_LOGS_DIR))).toEqual([]);
    expect(readdirSync(join(root, SESSIONS_DIR))).toEqual([]);
    expect(readdirSync(join(root, REFLECT_SESSIONS_DIR))).toEqual([]);
  });

  it("still prunes event logs on their own schedule", () => {
    makeFile(join(root, APP_LOGS_DIR), "old.jsonl", 30);
    expect(pruneSessionLogs(root, 7, NOW)).toBe(1);
  });
});
