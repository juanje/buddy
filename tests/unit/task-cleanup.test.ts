// tests/unit/task-cleanup.test.ts — FR-TASK-06, FR-TASKM-44 task cleanup.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { cleanupCompletedTasks } from "../../backends/tasks/task-cleanup";
import { tasksFilePath } from "../../backends/tasks/task-file";

describe("cleanupCompletedTasks", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("removes all done items", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-task-cleanup-"));
    mkdirSync(join(dir, "user"), { recursive: true });
    writeFileSync(
      tasksFilePath(dir),
      `---\ncreated: 2026-09-10\n---\n\n# Tasks\n\n- [x] Send invoice @work <!-- c:2026-09-10 -->\n- [ ] Review PR @work <!-- c:2026-09-10 -->\n`,
      "utf8",
    );
    const result = cleanupCompletedTasks(dir);
    expect(result.removed).toContain("Send invoice");
    const after = readFileSync(tasksFilePath(dir), "utf8");
    expect(after).not.toContain("Send invoice");
    expect(after).toContain("Review PR");
  });

  it("removes items with verify comments", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-task-cleanup-"));
    mkdirSync(join(dir, "user"), { recursive: true });
    writeFileSync(
      tasksFilePath(dir),
      `---\ncreated: 2026-09-10\n---\n\n# Tasks\n\n- [x] Old task @work <!-- c:2026-09-10 --> <!-- verify: not found in recent logs --> <!-- c:2026-09-10 -->\n- [ ] Active task @work <!-- c:2026-09-10 -->\n`,
      "utf8",
    );
    const result = cleanupCompletedTasks(dir);
    expect(result.removed.length).toBeGreaterThan(0);
    const after = readFileSync(tasksFilePath(dir), "utf8");
    expect(after).not.toContain("Old task");
    expect(after).not.toContain("verify:");
    expect(after).toContain("Active task");
  });

  it("does nothing when no done items", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-task-cleanup-"));
    mkdirSync(join(dir, "user"), { recursive: true });
    writeFileSync(
      tasksFilePath(dir),
      `---\ncreated: 2026-09-10\n---\n\n# Tasks\n\n- [ ] Open task @work <!-- c:2026-09-10 -->\n`,
      "utf8",
    );
    const result = cleanupCompletedTasks(dir);
    expect(result.removed).toEqual([]);
  });

  it("does nothing when tasks.md does not exist", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-task-cleanup-"));
    mkdirSync(join(dir, "user"), { recursive: true });
    const result = cleanupCompletedTasks(dir);
    expect(result.removed).toEqual([]);
  });
});
