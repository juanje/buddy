// tests/unit/reflect.test.ts — FR-REFLECT-01 skeleton + index rebuild.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  findPendingReflects,
  markReflectComplete,
  parseFrontmatter,
  rebuildLogsIndex,
  saveSessionSkeleton,
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

describe("saveSessionSkeleton", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("writes reflect-pending frontmatter and header", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-reflect-"));
    const tracker = new SessionTracker("abc12345");
    tracker.filesWritten.push("user/inbox.md");
    tracker.turnCount = 3;
    const path = saveSessionSkeleton(dir, tracker.toSnapshot());
    const content = readFileSync(path, "utf8");
    expect(parseFrontmatter(content).status).toBe("reflect-pending");
    expect(content).toContain("turns: 3");
    expect(content).toContain("# Session —");
  });
});

describe("rebuildLogsIndex", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("lists session logs in index.md", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-index-"));
    const logs = join(dir, "logs");
    require("node:fs").mkdirSync(logs, { recursive: true });
    writeFileSync(
      join(logs, "2026-07-19_abc.md"),
      "---\ndate: 2026-07-19\nsession_id: abc\nstatus: reflect-pending\n---\n",
    );
    rebuildLogsIndex(dir);
    const index = readFileSync(join(logs, "index.md"), "utf8");
    expect(index).toContain("2026-07-19");
    expect(index).toContain("reflect-pending");
  });
});

describe("findPendingReflects + markReflectComplete", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("finds and completes pending logs", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-pending-"));
    const tracker = new SessionTracker("pending1");
    const path = saveSessionSkeleton(dir, tracker.toSnapshot());
    expect(findPendingReflects(dir)).toHaveLength(1);
    markReflectComplete(path, "### Context\nDone.");
    expect(parseFrontmatter(readFileSync(path, "utf8")).status).toBe("complete");
    expect(readFileSync(path, "utf8")).toContain("Reflect summary");
  });
});
