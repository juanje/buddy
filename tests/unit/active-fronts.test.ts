// tests/unit/active-fronts.test.ts — FR-TASKM-41 compute active fronts from tasks.md.

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { computeActiveFronts, formatActiveFrontsBlock } from "../../backends/active-fronts";
import { bundledPromptsDir } from "../../backends/deploy-bundled-content";
import { writeTasksFile } from "../../backends/tasks/task-file";
import { addDays, toIsoDay } from "../../shared/dates";
import type { TaskItem } from "../../shared/task-types";

describe("computeActiveFronts", () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), "active-fronts-"));
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  function seed(items: TaskItem[]): void {
    writeTasksFile(rootDir, items);
  }

  it("counts each project as 1 front per area", () => {
    seed([
      { id: 1, text: "Review PR", done: false, next: false, area: "work", project: "buddy" },
      { id: 2, text: "Write tests", done: false, next: false, area: "work", project: "buddy" },
      { id: 3, text: "Deploy staging", done: false, next: false, area: "work", project: "infra" },
    ]);
    const report = computeActiveFronts(rootDir);
    expect(report.perArea).toEqual([{ area: "work", count: 2 }]);
    expect(report.total).toBe(2);
  });

  it("counts loose items as 1 front per area", () => {
    seed([
      { id: 1, text: "Call dentist", done: false, next: false, area: "health" },
      { id: 2, text: "Buy vitamins", done: false, next: false, area: "health" },
    ]);
    const report = computeActiveFronts(rootDir);
    expect(report.perArea).toEqual([{ area: "health", count: 1 }]);
    expect(report.total).toBe(1);
  });

  it("counts projects and loose items together in the same area", () => {
    seed([
      { id: 1, text: "Review PR", done: false, next: false, area: "work", project: "buddy" },
      { id: 2, text: "Deploy staging", done: false, next: false, area: "work", project: "infra" },
      { id: 3, text: "Check email", done: false, next: false, area: "work" },
    ]);
    const report = computeActiveFronts(rootDir);
    expect(report.perArea).toEqual([{ area: "work", count: 3 }]);
  });

  it("excludes @someday items", () => {
    seed([
      { id: 1, text: "Someday thing", done: false, next: false, area: "someday" },
      { id: 2, text: "Active thing", done: false, next: false, area: "work" },
    ]);
    const report = computeActiveFronts(rootDir);
    expect(report.perArea).toEqual([{ area: "work", count: 1 }]);
  });

  it("excludes future-dated items", () => {
    const future = addDays(toIsoDay(new Date()), 10);
    seed([
      { id: 1, text: "Future thing", done: false, next: false, area: "work", dueDate: future },
      { id: 2, text: "Active thing", done: false, next: false, area: "work" },
    ]);
    const report = computeActiveFronts(rootDir);
    expect(report.perArea).toEqual([{ area: "work", count: 1 }]);
  });

  it("excludes done items", () => {
    seed([
      { id: 1, text: "Finished", done: true, next: false, area: "work" },
      { id: 2, text: "Active thing", done: false, next: false, area: "work" },
    ]);
    const report = computeActiveFronts(rootDir);
    expect(report.perArea).toEqual([{ area: "work", count: 1 }]);
  });

  it("handles items without area as (general)", () => {
    seed([{ id: 1, text: "No area", done: false, next: false }]);
    const report = computeActiveFronts(rootDir);
    expect(report.perArea).toEqual([{ area: "(general)", count: 1 }]);
  });

  it("returns zero when tasks.md is empty", () => {
    seed([]);
    const report = computeActiveFronts(rootDir);
    expect(report.total).toBe(0);
    expect(report.perArea).toEqual([]);
  });

  it("returns zero when tasks.md does not exist", () => {
    const report = computeActiveFronts(rootDir);
    expect(report.total).toBe(0);
    expect(report.perArea).toEqual([]);
  });
});

describe("formatActiveFrontsBlock", () => {
  it("labels block as from tasks.md", () => {
    const block = formatActiveFrontsBlock({ perArea: [{ area: "work", count: 2 }], total: 2 });
    expect(block).toContain("Active fronts per area (from tasks.md):");
    expect(block).toContain("@work: 2");
  });
});

describe("bundled consolidation prompt", () => {
  it("contains Active fronts per area and does not contain activeNextCount", () => {
    const prompt = readFileSync(join(bundledPromptsDir(), "consolidation.md"), "utf8");
    expect(prompt).toContain("Active fronts per area");
    expect(prompt).not.toContain("activeNextCount");
  });

  it("active fronts check references tasks.md, not AGENTS.md (FR-TASKM-42)", () => {
    const prompt = readFileSync(join(bundledPromptsDir(), "consolidation.md"), "utf8");
    const match = prompt.match(/- \*\*Active fronts check:\*\*[\s\S]*?(?=\n- \*\*|\n\n)/);
    expect(match).not.toBeNull();
    const section = match![0];
    expect(section).toContain("from tasks.md");
    expect(section).not.toContain("from AGENTS.md");
  });
});
