// tests/unit/task-file.test.ts — FR-TASK-01 task file parse/serialize.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { TaskItem } from "../../shared/task-types";
import {
  parseTaskFileContent,
  readTasksFile,
  serializeTaskFile,
  writeTasksFile,
} from "../../backends/tasks/task-file";

describe("parseTaskFileContent", () => {
  it("round-trips items through serialize", () => {
    const items: TaskItem[] = [
      { id: 1, text: "Alpha", done: false, next: true, area: "work", dueDate: "2026-09-15" },
      { id: 2, text: "Beta", done: true, next: false, area: "personal", annotation: "urgent" },
    ];
    const serialized = serializeTaskFile(items, "2026-09-01");
    const parsed = parseTaskFileContent(serialized);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      text: "Alpha 2026-09-15",
      next: true,
      area: "work",
      dueDate: "2026-09-15",
    });
    expect(parsed[1]).toMatchObject({ done: true, annotation: "urgent", area: "personal" });
  });

  it("handles empty file", () => {
    expect(parseTaskFileContent("# Tasks\n")).toEqual([]);
  });

  it("parses project tag from task line", () => {
    const parsed = parseTaskFileContent(
      "- [ ] >> Call dentist #ley-dep @health\n",
    );
    expect(parsed[0]).toMatchObject({
      text: "Call dentist",
      project: "ley-dep",
      area: "health",
      next: true,
    });
  });

  it("serializes project tag before area", () => {
    const serialized = serializeTaskFile([
      { id: 1, text: "Get DNI copy", done: false, next: true, project: "ley-dep", area: "family" },
    ]);
    expect(serialized).toContain("#ley-dep @family");
  });

  it("round-trip parse-serialize preserves project", () => {
    const items: TaskItem[] = [
      { id: 1, text: "Call dentist", done: false, next: true, project: "ley-dep", area: "health" },
    ];
    const parsed = parseTaskFileContent(serializeTaskFile(items));
    expect(parsed[0]?.project).toBe("ley-dep");
  });
});

describe("writeTasksFile", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("creates tasks.md when missing", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-task-file-"));
    writeTasksFile(dir, [{ id: 1, text: "One", done: false, next: true }]);
    const { items } = readTasksFile(dir);
    expect(items).toHaveLength(1);
    expect(items[0].text).toBe("One");
  });
});
