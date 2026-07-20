// tests/unit/reflect.test.ts — FR-REFLECT-01 pending skeleton + daily logs + index rebuild.

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { PENDING_DIR } from "../../shared/defaults";
import {
  appendDailyLog,
  findPendingReflects,
  parseFrontmatter,
  rebuildLogsIndex,
  savePendingSkeleton,
  shouldRunIncrementalReflect,
} from "../../backends/reflect";
import { SessionTracker } from "../../backends/session-tracker";

describe("shouldRunIncrementalReflect", () => {
  it("fires on multiples of N after last snapshot", () => {
    expect(shouldRunIncrementalReflect(15, 15, 0)).toBe(true);
    expect(shouldRunIncrementalReflect(14, 15, 0)).toBe(false);
    expect(shouldRunIncrementalReflect(30, 15, 15)).toBe(true);
  });
});

describe("savePendingSkeleton", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("writes reflect-pending skeleton under .ab-app/pending/", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-reflect-"));
    const tracker = new SessionTracker("abc12345");
    tracker.filesWritten.push("user/inbox.md");
    tracker.turnCount = 3;
    const path = savePendingSkeleton(dir, tracker.toSnapshot());
    expect(path).toContain(PENDING_DIR);
    const content = readFileSync(path, "utf8");
    expect(parseFrontmatter(content).status).toBe("reflect-pending");
    expect(content).toContain("turns: 3");
    expect(content).toContain("# Session —");
    expect(existsSync(join(dir, "logs"))).toBe(false);
  });
});

describe("appendDailyLog", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("creates daily log with session header", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-daily-"));
    const path = appendDailyLog(dir, {
      date: "2026-07-19",
      sessionHeader: "14:00–14:30",
      sections: "### Context\nWorked on reflect pipeline.",
    });
    const content = readFileSync(path, "utf8");
    expect(content).toContain("# Log — 2026-07-19");
    expect(content).toContain("## Session 14:00–14:30");
    expect(content).toContain("Worked on reflect pipeline.");
  });

  it("appends a second session to an existing daily log", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-daily-"));
    appendDailyLog(dir, {
      date: "2026-07-19",
      sessionHeader: "10:00–10:15",
      sections: "### Context\nMorning session.",
    });
    appendDailyLog(dir, {
      date: "2026-07-19",
      sessionHeader: "14:00–14:30",
      sections: "### Context\nAfternoon session.",
    });
    const content = readFileSync(join(dir, "logs", "2026-07-19.md"), "utf8");
    expect(content).toContain("## Session 10:00–10:15");
    expect(content).toContain("## Session 14:00–14:30");
  });
});

describe("rebuildLogsIndex", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("lists daily logs in index.md with summary", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-index-"));
    appendDailyLog(dir, {
      date: "2026-07-19",
      sessionHeader: "12:00–12:30",
      sections: "### Context\nReflect pipeline redesign.",
    });
    rebuildLogsIndex(dir);
    const index = readFileSync(join(dir, "logs", "index.md"), "utf8");
    expect(index).toContain("logs/YYYY-MM-DD.md");
    expect(index).toContain("2026-07-19:");
    expect(index).toContain("Reflect pipeline redesign.");
  });
});

describe("findPendingReflects", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("finds pending skeletons in .ab-app/pending/", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-pending-"));
    const tracker = new SessionTracker("pending1");
    const path = savePendingSkeleton(dir, tracker.toSnapshot());
    const pending = findPendingReflects(dir);
    expect(pending).toHaveLength(1);
    expect(pending[0].path).toBe(path);
    expect(pending[0].sessionId).toBe("pending1");
  });

  it("ignores non-pending files", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-pending-"));
    const pendingDir = join(dir, PENDING_DIR);
    require("node:fs").mkdirSync(pendingDir, { recursive: true });
    writeFileSync(
      join(pendingDir, "done.md"),
      "---\ndate: 2026-07-19\nstatus: complete\n---\n",
    );
    expect(findPendingReflects(dir)).toHaveLength(0);
  });
});
