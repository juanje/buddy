// tests/unit/task-file.test.ts — FR-TASK-01 task file parse/serialize.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { TaskItem } from "../../shared/task-types";
import {
  buildListResult,
  parseTaskFileContent,
  readTasksFile,
  serializeTaskFile,
  tasksFilePath,
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

  it("parses created comment from task line", () => {
    const parsed = parseTaskFileContent("- [ ] Buy milk @personal <!-- c:2026-01-01 -->\n");
    expect(parsed[0]?.created).toBe("2026-01-01");
    expect(parsed[0]?.text).toBe("Buy milk");
  });

  it("serializes created comment at line end", () => {
    const serialized = serializeTaskFile([
      { id: 1, text: "Buy milk", done: false, next: false, area: "personal", created: "2026-01-01" },
    ]);
    expect(serialized).toContain("<!-- c:2026-01-01 -->");
    expect(serialized).toMatch(/@personal <!-- c:2026-01-01 -->/);
  });

  it("round-trip parse-serialize preserves created", () => {
    const items: TaskItem[] = [
      { id: 1, text: "Buy milk", done: false, next: false, area: "personal", created: "2026-01-01" },
    ];
    const parsed = parseTaskFileContent(serializeTaskFile(items));
    expect(parsed[0]?.created).toBe("2026-01-01");
  });
});

describe("buildListResult", () => {
  it("staleDays is exactly 59 for item created on 2026-01-01 listed on 2026-03-01", () => {
    const result = buildListResult(
      [{ id: 1, text: "Old", done: false, next: false, area: "work", created: "2026-01-01" }],
      "2026-03-01",
    );
    expect(result.items[0]?.staleDays).toBe(59);
  });

  it("staleDays is undefined at exactly 30 days", () => {
    const result = buildListResult(
      [{ id: 1, text: "X", done: false, next: false, area: "work", created: "2026-01-01" }],
      "2026-01-31",
    );
    expect(result.items[0]?.staleDays).toBeUndefined();
  });

  it("staleDays is 31 at exactly 31 days", () => {
    const result = buildListResult(
      [{ id: 1, text: "X", done: false, next: false, area: "work", created: "2026-01-01" }],
      "2026-02-01",
    );
    expect(result.items[0]?.staleDays).toBe(31);
  });

  it("staleDays is undefined on done items", () => {
    const result = buildListResult(
      [{ id: 1, text: "X", done: true, next: false, area: "work", created: "2026-01-01" }],
      "2026-03-01",
    );
    expect(result.items[0]?.staleDays).toBeUndefined();
  });

  it("does not set staleDays on next items", () => {
    const result = buildListResult(
      [{ id: 1, text: "Old next", done: false, next: true, area: "work", created: "2026-01-01" }],
      "2026-03-01",
    );
    expect(result.items[0]?.staleDays).toBeUndefined();
  });
});

describe("readTasksFile", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("infers created from file frontmatter when line has no comment", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-task-file-read-"));
    const path = tasksFilePath(dir);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
      path,
      `---
created: 2026-01-15
---

# Tasks

- [ ] Old task @work
`,
      "utf8",
    );
    const { items } = readTasksFile(dir);
    expect(items[0]?.created).toBe("2026-01-15");
  });

  it("line created comment wins over file frontmatter", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-task-file-read-"));
    const path = tasksFilePath(dir);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
      path,
      `---
created: 2026-01-15
---

# Tasks

- [ ] Old task @work <!-- c:2026-02-01 -->
`,
      "utf8",
    );
    const { items } = readTasksFile(dir);
    expect(items[0]?.created).toBe("2026-02-01");
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
