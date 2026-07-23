// tests/unit/reflect.test.ts — FR-REFLECT-01 pending skeleton + daily logs + index rebuild.

import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { PENDING_DIR, INCREMENTAL_REFLECT_EVERY } from "../../shared/defaults";
import {
  appendDailyLog,
  findPendingReflects,
  markPendingInProgress,
  parseFrontmatter,
  sanitizeReflectOutput,
  savePendingSkeleton,
  shouldRunCheckpointReflect,
  finalizeCheckpointToDailyLog,
  updateLogsIndexEntry,
} from "../../backends/reflect";
import { SessionTracker } from "../../backends/session-tracker";

describe("shouldRunCheckpointReflect", () => {
  it("fires on multiples of N after last checkpoint", () => {
    expect(shouldRunCheckpointReflect(INCREMENTAL_REFLECT_EVERY, INCREMENTAL_REFLECT_EVERY, 0)).toBe(true);
    expect(shouldRunCheckpointReflect(INCREMENTAL_REFLECT_EVERY - 1, INCREMENTAL_REFLECT_EVERY, 0)).toBe(false);
    expect(shouldRunCheckpointReflect(INCREMENTAL_REFLECT_EVERY * 2, INCREMENTAL_REFLECT_EVERY, INCREMENTAL_REFLECT_EVERY)).toBe(true);
  });
});

describe("sanitizeReflectOutput", () => {
  it("strips to=functions tool leak lines", () => {
    const input = "### Context\nNormal note.\n\nto=functions.read code: {\"path\":\"foo.md\"}\n\n### Lessons\nAll good.";
    const out = sanitizeReflectOutput(input);
    expect(out).not.toContain("to=functions.read");
    expect(out).toContain("Normal note.");
    expect(out).toContain("All good.");
  });

  it("strips inline JSON tool call objects", () => {
    const input = '### Context\n{"name":"read","arguments":{"path":"user/inbox.md"}}\nDone.';
    const out = sanitizeReflectOutput(input);
    expect(out).not.toContain('"name":"read"');
    expect(out).toContain("Done.");
  });

  it("preserves normal markdown and collapses extra blank lines", () => {
    const input = "### Context\n\nLine one.\n\n\n\n### Lessons\nLine two.";
    const out = sanitizeReflectOutput(input);
    expect(out).toBe("### Context\n\nLine one.\n\n### Lessons\nLine two.");
  });
});

describe("savePendingSkeleton", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("writes reflect-pending skeleton under .buddy/pending/", () => {
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
    expect(content).toContain("## Files written");
    expect(content).toContain("- user/inbox.md");
    expect(content).toContain("## Files read");
    expect(content).toContain("(none)");
    expect(existsSync(join(dir, "logs"))).toBe(false);
  });

  it("uses session start date when session crosses midnight", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-reflect-"));
    const start = new Date(2026, 6, 20, 23, 45, 0);
    const end = new Date(2026, 6, 21, 0, 15, 0);
    const tracker = new SessionTracker("crossmid", start);
    const path = savePendingSkeleton(dir, tracker.toSnapshot(end));
    const fm = parseFrontmatter(readFileSync(path, "utf8"));
    expect(fm.date).toBe("2026-07-20");
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

  it("appends a checkpoint block to the daily log", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-daily-"));
    const path = appendDailyLog(dir, {
      date: "2026-07-21",
      sessionHeader: "10:30",
      sections: "### Context\nWiki work.\n\n### Notes\nFiled concepts.",
      blockKind: "checkpoint",
    });
    const content = readFileSync(path, "utf8");
    expect(content).toContain("## Checkpoint 10:30");
    expect(content).toContain("Wiki work.");
  });
});

describe("finalizeCheckpointToDailyLog", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("writes checkpoint section and rebuilds index", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-checkpoint-log-"));
    const path = finalizeCheckpointToDailyLog({
      rootDir: dir,
      date: "2026-07-21",
      checkpointTime: "11:45",
      sections: "### Context\nMid-session encode.",
    });
    const content = readFileSync(path, "utf8");
    expect(content).toContain("## Checkpoint 11:45");
    expect(readFileSync(join(dir, "logs", "index.md"), "utf8")).toContain("2026-07-21:");
  });
});

describe("updateLogsIndexEntry", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("creates index with header and entry when missing", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-index-"));
    appendDailyLog(dir, {
      date: "2026-07-19",
      sessionHeader: "12:00–12:30",
      sections: "### Context\nReflect pipeline redesign.",
    });
    updateLogsIndexEntry(dir, "2026-07-19");
    const index = readFileSync(join(dir, "logs", "index.md"), "utf8");
    expect(index).toContain("# Sessions index");
    expect(index).toContain("2026-07-19: active — Reflect pipeline redesign.");
  });

  it("updates existing entry without touching others", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-index-"));
    mkdirSync(join(dir, "logs"), { recursive: true });
    writeFileSync(
      join(dir, "logs", "index.md"),
      [
        "# Sessions index",
        "",
        "Log files: `logs/YYYY-MM-DD.md` (derive from the date in each entry).",
        "",
        "- 2026-07-18: active — Prior day work.",
        "- 2026-07-19: active — Old summary.",
        "- 2026-03-23 to 2026-03-26: archived (monthly). Content: Multi-day range.",
        "",
      ].join("\n"),
      "utf8",
    );
    appendDailyLog(dir, {
      date: "2026-07-19",
      sessionHeader: "14:00–14:30",
      sections: "### Context\nUpdated reflect.",
    });
    updateLogsIndexEntry(dir, "2026-07-19");
    const index = readFileSync(join(dir, "logs", "index.md"), "utf8");
    expect(index).toContain("2026-07-19: active — Updated reflect.");
    expect(index).toContain("2026-07-18: active — Prior day work.");
    expect(index).toContain("archived (monthly)");
  });

  it("inserts new entry in sorted position", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-index-"));
    mkdirSync(join(dir, "logs"), { recursive: true });
    writeFileSync(
      join(dir, "logs", "index.md"),
      [
        "# Sessions index",
        "",
        "Log files: `logs/YYYY-MM-DD.md` (derive from the date in each entry).",
        "",
        "- 2026-07-18: active — Day 18.",
        "- 2026-07-20: active — Day 20.",
        "",
      ].join("\n"),
      "utf8",
    );
    appendDailyLog(dir, {
      date: "2026-07-19",
      sessionHeader: "10:00–10:30",
      sections: "### Context\nInserted day.",
    });
    updateLogsIndexEntry(dir, "2026-07-19");
    const index = readFileSync(join(dir, "logs", "index.md"), "utf8");
    const lines = index.split("\n").filter((l) => l.startsWith("- "));
    expect(lines[0]).toContain("2026-07-18");
    expect(lines[1]).toContain("2026-07-19");
    expect(lines[2]).toContain("2026-07-20");
  });

  it("uses maintenance status when specified", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-index-"));
    appendDailyLog(dir, {
      date: "2026-07-20",
      sessionHeader: "03:00 consolidation",
      sections: "Maintenance cycle completed: depth-1.",
      status: "maintenance",
    });
    updateLogsIndexEntry(dir, "2026-07-20", "maintenance");
    const index = readFileSync(join(dir, "logs", "index.md"), "utf8");
    expect(index).toContain("2026-07-20: maintenance —");
  });

  it("does not downgrade active to maintenance", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-index-"));
    mkdirSync(join(dir, "logs"), { recursive: true });
    writeFileSync(
      join(dir, "logs", "index.md"),
      [
        "# Sessions index",
        "",
        "Log files: `logs/YYYY-MM-DD.md` (derive from the date in each entry).",
        "",
        "- 2026-07-21: active — Real work day.",
        "",
      ].join("\n"),
      "utf8",
    );
    appendDailyLog(dir, {
      date: "2026-07-21",
      sessionHeader: "23:00 consolidation",
      sections: "Maintenance cycle completed: depth-2.",
      status: "maintenance",
    });
    updateLogsIndexEntry(dir, "2026-07-21", "maintenance");
    const index = readFileSync(join(dir, "logs", "index.md"), "utf8");
    expect(index).toContain("2026-07-21: active —");
    expect(index).not.toContain("2026-07-21: maintenance —");
  });
});

describe("findPendingReflects", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("finds pending skeletons in .buddy/pending/", () => {
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
    mkdirSync(pendingDir, { recursive: true });
    writeFileSync(
      join(pendingDir, "done.md"),
      "---\ndate: 2026-07-19\nstatus: complete\n---\n",
    );
    expect(findPendingReflects(dir)).toHaveLength(0);
  });

  it("markPendingInProgress flips status to reflect-in-progress", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-pending-"));
    const path = savePendingSkeleton(dir, new SessionTracker("flip").toSnapshot());

    markPendingInProgress(path);

    const content = readFileSync(path, "utf8");
    expect(parseFrontmatter(content).status).toBe("reflect-in-progress");
  });

  it("skips reflect-in-progress skeletons", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-pending-"));
    const path = savePendingSkeleton(dir, new SessionTracker("inprog").toSnapshot());
    markPendingInProgress(path);

    expect(findPendingReflects(dir)).toHaveLength(0);
  });

  it("markPendingInProgress is a no-op for missing path", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-pending-"));
    expect(() => markPendingInProgress(join(dir, PENDING_DIR, "missing.md"))).not.toThrow();
  });
});
