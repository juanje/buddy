// tests/unit/session-log-prune.test.ts — NFR-MAINT-01 session log retention.

import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { pruneSessionLogs } from "../../backends/session-log-prune";
import { APP_LOGS_DIR } from "../../shared/defaults";
import { MS_PER_DAY } from "../../shared/dates";

describe("session log prune", () => {
  let rootDir: string;
  let logsDir: string;
  const nowMs = Date.parse("2026-07-24T12:00:00.000Z");

  afterEach(() => {
    if (rootDir) rmSync(rootDir, { recursive: true, force: true });
  });

  function touch(name: string, daysAgo: number): void {
    const filePath = join(logsDir, name);
    writeFileSync(filePath, "{}", "utf8");
    const mtime = new Date(nowMs - daysAgo * MS_PER_DAY);
    utimesSync(filePath, mtime, mtime);
  }

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), "ab-log-prune-"));
    logsDir = join(rootDir, APP_LOGS_DIR);
    mkdirSync(logsDir, { recursive: true });
  });

  it("deletes jsonl logs older than retention period", () => {
    touch("2026-07-10.jsonl", 10);
    touch("2026-07-23.jsonl", 1);

    const removed = pruneSessionLogs(rootDir, 7, nowMs);

    expect(removed).toBe(1);
    expect(existsSync(join(logsDir, "2026-07-10.jsonl"))).toBe(false);
    expect(existsSync(join(logsDir, "2026-07-23.jsonl"))).toBe(true);
  });

  it("ignores non-jsonl files", () => {
    touch("notes.txt", 30);

    const removed = pruneSessionLogs(rootDir, 7, nowMs);

    expect(removed).toBe(0);
    expect(existsSync(join(logsDir, "notes.txt"))).toBe(true);
  });

  it("returns zero when logs directory is missing", () => {
    rmSync(logsDir, { recursive: true, force: true });
    expect(pruneSessionLogs(rootDir, 7, nowMs)).toBe(0);
  });
});
