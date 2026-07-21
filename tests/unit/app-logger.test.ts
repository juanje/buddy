// tests/unit/app-logger.test.ts — App JSONL event logger.

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { logEvent } from "../../backends/app-logger";
import { APP_LOGS_DIR } from "../../shared/defaults";

describe("logEvent", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("appends JSONL lines to .buddy/logs/YYYY-MM-DD.jsonl", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-applog-"));
    const now = new Date("2026-07-19T14:30:00.000Z");
    logEvent(dir, { event: "session_start", session: "abc12345" }, now);
    logEvent(dir, { event: "turn_end", session: "abc12345", turn: 1 }, now);

    const logPath = join(dir, APP_LOGS_DIR, "2026-07-19.jsonl");
    const lines = readFileSync(logPath, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toMatchObject({
      event: "session_start",
      session: "abc12345",
    });
    expect(JSON.parse(lines[1])).toMatchObject({
      event: "turn_end",
      session: "abc12345",
      turn: 1,
    });
  });
});
