// tests/unit/reflect.test.ts — FR-REFLECT daily logs + index rebuild.

import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  appendDailyLog,
  finalizeCheckpointToDailyLog,
  finalizeReflectToDailyLog,
  parseFrontmatter,
  sanitizeReflectOutput,
  updateLogsIndexEntry,
} from "../../backends/reflect";

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

  it("strips a leading ## Session header from LLM output", () => {
    const input = "## Session 00:00–00:00\n\n### Context\nWorked on feature X.";
    const out = sanitizeReflectOutput(input);
    expect(out).not.toContain("## Session 00:00");
    expect(out).toContain("### Context");
    expect(out).toContain("Worked on feature X.");
  });

  it("strips a leading ## Checkpoint header from LLM output", () => {
    const input = "## Checkpoint 10:30\n\n### Context\nMid-session encode.";
    const out = sanitizeReflectOutput(input);
    expect(out).not.toContain("## Checkpoint");
    expect(out).toContain("Mid-session encode.");
  });

  it("normalizes ## section headings to ###", () => {
    const input = "## Context\n\nWorked on feature X.\n\n## Open threads\n\nReview draft.";
    const out = sanitizeReflectOutput(input);
    expect(out).toContain("### Context");
    expect(out).toContain("### Open threads");
    expect(out).not.toMatch(/^## Context/m);
  });
});

describe("finalizeReflectToDailyLog", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("appends session block using metadata args", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-finalize-"));
    const path = finalizeReflectToDailyLog({
      rootDir: dir,
      sessionDate: "2026-07-23",
      sessionHeader: "14:30–15:45",
      sections: "### Context\nWorked on reflect pipeline.",
    });
    const content = readFileSync(path, "utf8");
    expect(content).toContain("# Log — 2026-07-23");
    expect(content).toContain("## Session 14:30–15:45");
    expect(content).toContain("Worked on reflect pipeline.");
  });

  it("uses session start date for cross-midnight sessions", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-finalize-"));
    finalizeReflectToDailyLog({
      rootDir: dir,
      sessionDate: "2026-07-20",
      sessionHeader: "23:45–00:15",
      sections: "### Context\nLate session.",
    });
    expect(existsSync(join(dir, "logs", "2026-07-20.md"))).toBe(true);
    expect(existsSync(join(dir, "logs", "2026-07-21.md"))).toBe(false);
  });
});

describe("appendDailyLog", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("creates daily log with session header", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-daily-"));
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
    dir = mkdtempSync(join(tmpdir(), "buddy-daily-"));
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
    dir = mkdtempSync(join(tmpdir(), "buddy-daily-"));
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
    dir = mkdtempSync(join(tmpdir(), "buddy-checkpoint-log-"));
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
    dir = mkdtempSync(join(tmpdir(), "buddy-index-"));
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

  it("preserves existing entry on reflect without explicit description", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-index-"));
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
    expect(index).toContain("2026-07-19: active — Old summary.");
    expect(index).not.toContain("Updated reflect.");
    expect(index).toContain("2026-07-18: active — Prior day work.");
    expect(index).toContain("archived (monthly)");
  });

  it("uses explicit description when provided", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-index-"));
    mkdirSync(join(dir, "logs"), { recursive: true });
    writeFileSync(
      join(dir, "logs", "index.md"),
      "# Sessions index\n\n- 2026-07-23: active — stale one-liner\n",
      "utf8",
    );
    writeFileSync(join(dir, "logs", "2026-07-23.md"), "### Context\nDifferent context line.\n");

    updateLogsIndexEntry(dir, "2026-07-23", "active", "Key themes from Day summary");
    const index = readFileSync(join(dir, "logs", "index.md"), "utf8");
    expect(index).toContain("- 2026-07-23: active — Key themes from Day summary");
    expect(index).not.toContain("stale one-liner");
  });

  it("inserts new entry in sorted position", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-index-"));
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
    dir = mkdtempSync(join(tmpdir(), "buddy-index-"));
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
    dir = mkdtempSync(join(tmpdir(), "buddy-index-"));
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

  it("preserves curated description when blocking maintenance downgrade", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-index-"));
    mkdirSync(join(dir, "logs"), { recursive: true });
    writeFileSync(
      join(dir, "logs", "index.md"),
      "- 2026-07-23: active — Key themes from Day summary\n",
      "utf8",
    );
    writeFileSync(join(dir, "logs", "2026-07-23.md"), "### Context\nDifferent maintenance context.\n");

    updateLogsIndexEntry(dir, "2026-07-23", "maintenance");
    const index = readFileSync(join(dir, "logs", "index.md"), "utf8");
    expect(index).toContain("- 2026-07-23: active — Key themes from Day summary");
    expect(index).not.toContain("Different maintenance context");
  });

  it("does not overwrite existing entry when called without explicit description", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-index-"));
    mkdirSync(join(dir, "logs"), { recursive: true });
    writeFileSync(
      join(dir, "logs", "index.md"),
      "- 2026-07-23: active — Key themes from Day summary\n",
      "utf8",
    );
    appendDailyLog(dir, {
      date: "2026-07-23",
      sessionHeader: "14:30–15:45",
      sections: "### Context\nDifferent context line.",
    });

    updateLogsIndexEntry(dir, "2026-07-23");
    const index = readFileSync(join(dir, "logs", "index.md"), "utf8");
    expect(index).toContain("- 2026-07-23: active — Key themes from Day summary");
    expect(index).not.toContain("Different context line");
  });
});

describe("parseFrontmatter", () => {
  it("parses yaml frontmatter fields", () => {
    const fm = parseFrontmatter("---\ndate: 2026-07-23\nstatus: active\n---\n");
    expect(fm.date).toBe("2026-07-23");
    expect(fm.status).toBe("active");
  });
});
