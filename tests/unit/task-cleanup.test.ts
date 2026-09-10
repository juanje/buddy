// tests/unit/task-cleanup.test.ts — FR-TASK-06 task cleanup.

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

  it("removes done items verified in log", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-task-cleanup-"));
    mkdirSync(join(dir, "user"), { recursive: true });
    writeFileSync(
      tasksFilePath(dir),
      `---
created: 2026-09-10
---

# Tasks

- [x] Send invoice @work
`,
      "utf8",
    );
    const log = "## Session\n\nSend invoice completed and shipped today.";
    const result = cleanupCompletedTasks(dir, log);
    expect(result.removed).toContain("Send invoice");
    const after = readFileSync(tasksFilePath(dir), "utf8");
    expect(after).not.toContain("Send invoice");
  });

  it("flags unverified done items", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-task-cleanup-"));
    mkdirSync(join(dir, "user"), { recursive: true });
    writeFileSync(
      tasksFilePath(dir),
      `---
created: 2026-09-10
---

# Tasks

- [x] Mystery task
`,
      "utf8",
    );
    const result = cleanupCompletedTasks(dir, "Nothing relevant here.");
    expect(result.flagged).toContain("Mystery task");
    const after = readFileSync(tasksFilePath(dir), "utf8");
    expect(after).toContain("verify:");
  });
});
