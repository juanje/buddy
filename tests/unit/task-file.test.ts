// tests/unit/task-file.test.ts — FR-TASK-01 task file parse/serialize.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { TaskItem } from "../../shared/task-types";
import {
  buildListResult,
  buildUntaggedClusters,
  clearNextInScope,
  countActiveInArea,
  countActiveInScope,
  countActiveNext,
  parseTaskFileContent,
  readTasksFile,
  scopeHasNext,
  serializeTaskFile,
  tasksFilePath,
  writeTasksFile,
} from "../../backends/tasks/task-file";
import { addDays, toIsoDay } from "../../shared/dates";

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

describe("countActiveNext", () => {
  it("counts open next items excluding someday and future", () => {
    const count = countActiveNext(
      [
        { id: 1, text: "A", done: false, next: true, area: "work" },
        { id: 2, text: "B", done: false, next: false, area: "work" },
        { id: 3, text: "S", done: false, next: true, area: "someday" },
        { id: 4, text: "F", done: false, next: true, area: "personal", dueDate: "2099-01-01" },
        { id: 5, text: "D", done: true, next: true, area: "work" },
      ],
      "2026-09-10",
    );
    expect(count).toBe(1);
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

describe("countActiveInArea", () => {
  it("excludes someday and future-dated items in the area", () => {
    const today = toIsoDay(new Date());
    const future = addDays(today, 10);
    const items: TaskItem[] = [
      { id: 1, text: "Open one", done: false, next: false, area: "work" },
      { id: 2, text: "Open two", done: false, next: false, area: "work" },
      { id: 3, text: "Parked", done: false, next: false, area: "someday" },
      { id: 4, text: "Future", done: false, next: false, area: "work", dueDate: future },
      { id: 5, text: "Done", done: true, next: false, area: "work" },
    ];
    expect(countActiveInArea(items, "work", today)).toBe(2);
  });
});

describe("clearNextInScope", () => {
  it("clears next only within the same project", () => {
    const items: TaskItem[] = [
      { id: 1, text: "A1", done: false, next: true, area: "work", project: "alpha" },
      { id: 2, text: "A2", done: false, next: false, area: "work", project: "alpha" },
      { id: 3, text: "B1", done: false, next: true, area: "work", project: "beta" },
    ];
    clearNextInScope(items, "work", "alpha");
    expect(items[0].next).toBe(false);
    expect(items[2].next).toBe(true);
  });

  it("clears next only among loose items in the area", () => {
    const items: TaskItem[] = [
      { id: 1, text: "Loose", done: false, next: true, area: "work" },
      { id: 2, text: "Tagged", done: false, next: true, area: "work", project: "alpha" },
    ];
    clearNextInScope(items, "work");
    expect(items[0].next).toBe(false);
    expect(items[1].next).toBe(true);
  });
});

describe("scopeHasNext", () => {
  it("returns true only for the matching scope", () => {
    const items: TaskItem[] = [
      { id: 1, text: "A1", done: false, next: true, area: "work", project: "alpha" },
      { id: 2, text: "Loose", done: false, next: false, area: "work" },
    ];
    expect(scopeHasNext(items, "work", "alpha")).toBe(true);
    expect(scopeHasNext(items, "work")).toBe(false);
  });
});

describe("countActiveInScope", () => {
  it("counts only items in the project scope", () => {
    const today = toIsoDay(new Date());
    const items: TaskItem[] = [
      { id: 1, text: "A1", done: false, next: true, area: "work", project: "alpha" },
      { id: 2, text: "A2", done: false, next: false, area: "work", project: "alpha" },
      { id: 3, text: "B1", done: false, next: false, area: "work", project: "beta" },
    ];
    expect(countActiveInScope(items, "work", "alpha", today)).toBe(2);
  });
});

describe("buildUntaggedClusters", () => {
  it("returns areas with 3+ open untagged items excluding someday and project tags", () => {
    const items: TaskItem[] = [
      { id: 1, text: "W1", done: false, next: false, area: "work" },
      { id: 2, text: "W2", done: false, next: false, area: "work" },
      { id: 3, text: "W3", done: false, next: false, area: "work" },
      { id: 4, text: "W4", done: false, next: false, area: "work" },
      { id: 5, text: "H1", done: false, next: false, area: "health" },
      { id: 6, text: "H2", done: false, next: false, area: "health" },
      { id: 7, text: "Parked", done: false, next: false, area: "someday" },
      { id: 8, text: "Tagged", done: false, next: false, area: "work", project: "foo" },
      { id: 9, text: "Done", done: true, next: false, area: "work" },
    ];
    expect(buildUntaggedClusters(items)).toEqual([{ area: "work", count: 4 }]);
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
