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
  it("labels block as from tasks.md with default limit", () => {
    const block = formatActiveFrontsBlock({ perArea: [{ area: "work", count: 2 }], total: 2 });
    expect(block).toContain("Active fronts per area (from tasks.md):");
    expect(block).toContain("@work: 2 (limit: 3)");
  });

  it("shows no limit when area override is null", () => {
    const block = formatActiveFrontsBlock(
      { perArea: [{ area: "work", count: 5 }], total: 5 },
      { wipLimit: 3, wipLimitOverrides: { work: null } },
    );
    expect(block).toContain("@work: 5 (no limit)");
  });

  it("shows numeric override per area", () => {
    const block = formatActiveFrontsBlock(
      { perArea: [{ area: "personal", count: 2 }], total: 2 },
      { wipLimit: 3, wipLimitOverrides: { personal: 5 } },
    );
    expect(block).toContain("@personal: 2 (limit: 5)");
  });

  it("mixed areas get distinct limit labels", () => {
    const block = formatActiveFrontsBlock(
      {
        perArea: [
          { area: "work", count: 5 },
          { area: "personal", count: 2 },
        ],
        total: 7,
      },
      { wipLimit: 3, wipLimitOverrides: { work: null, personal: 5 } },
    );
    expect(block).toContain("@work: 5 (no limit)");
    expect(block).toContain("@personal: 2 (limit: 5)");
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

  it("active fronts check respects per-area limits (FR-TASKM-46)", () => {
    const prompt = readFileSync(join(bundledPromptsDir(), "consolidation.md"), "utf8");
    const match = prompt.match(/- \*\*Active fronts check:\*\*[\s\S]*?(?=\n- \*\*|\n\n)/);
    expect(match).not.toBeNull();
    const section = match![0];
    expect(section).toContain("(no limit)");
    expect(section).toContain("portfolio areas");
  });

  it("step 9a excludes tasks/projects from Right now guidance (FR-TASKM-43)", () => {
    const prompt = readFileSync(join(bundledPromptsDir(), "consolidation.md"), "utf8");
    const match = prompt.match(/#### 9a\.[\s\S]*?(?=\n#### \d|\n### \d|\n## )/);
    expect(match).not.toBeNull();
    const section = match![0];
    expect(section).toContain("Do not add tasks, projects, or next actions");
    expect(section).toContain("tasks.md");
  });
});

describe("bundled process-conversation prompt", () => {
  it("step 4 excludes tasks/projects from Right now patches (FR-TASKM-43)", () => {
    const prompt = readFileSync(join(bundledPromptsDir(), "process-conversation.md"), "utf8");
    const match = prompt.match(/### 4\.[\s\S]*?(?=\n### \d|\n## )/);
    expect(match).not.toBeNull();
    const section = match![0];
    expect(section).toContain("Tasks, projects, or next actions");
    expect(section).toContain("tasks.md");
  });
});
