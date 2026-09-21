// tests/steps/wip-overrides.steps.ts — FR-TASKM-46 per-area WIP overrides.

import { After, Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { computeActiveFronts, formatActiveFrontsBlock } from "../../backends/active-fronts";
import { createBuddyInstance, defaultTemplatesDir } from "../../backends/create-buddy";
import { executeTaskAction } from "../../backends/tasks/task-actions";
import { readTaskConfig, writeTaskWipOverrides } from "../../backends/tasks/task-config";
import { writeTasksFile } from "../../backends/tasks/task-file";
import { taskResultToText } from "../../backends/tasks/task-result";
import type { SetupConfig } from "../../shared/api";
import type { TaskItem } from "../../shared/task-types";
import { setupGlobalConfigDir } from "../support/global-config";
import type { BuddyWorld } from "../support/world";

interface WipOverridesWorld extends BuddyWorld {
  memoryTmpDir?: string;
  buddyDir?: string;
  globalConfigDir?: string;
  activeFrontsBlock?: string;
  taskResultText?: string;
}

After(function (this: WipOverridesWorld) {
  if (this.memoryTmpDir) rmSync(this.memoryTmpDir, { recursive: true, force: true });
});

function root(this: WipOverridesWorld): string {
  assert.ok(this.buddyDir, "buddyDir required");
  return this.buddyDir;
}

function seedPortfolioTasks(buddyDir: string): void {
  const workProjects = ["p1", "p2", "p3", "p4", "p5"];
  const personalProjects = ["a", "b"];
  const items: TaskItem[] = [
    ...workProjects.map((project, index) => ({
      id: index + 1,
      text: `Work task ${project}`,
      done: false,
      next: false,
      area: "work",
      project,
    })),
    ...personalProjects.map((project, index) => ({
      id: workProjects.length + index + 1,
      text: `Personal task ${project}`,
      done: false,
      next: false,
      area: "personal",
      project,
    })),
  ];
  writeTasksFile(buddyDir, items);
}

Given("an initialized buddy git repository with tasks", async function (this: WipOverridesWorld) {
  this.memoryTmpDir = mkdtempSync(join(tmpdir(), "buddy-wip-overrides-"));
  this.buddyDir = join(this.memoryTmpDir, "buddy");
  const { configDir } = setupGlobalConfigDir();
  this.globalConfigDir = configDir;
  const config: SetupConfig = {
    rootDir: this.buddyDir,
    provider: "anthropic",
    model: "claude-haiku-4-5",
    language: "en",
    name: "Test",
  };
  await createBuddyInstance({
    config,
    configPath: join(this.memoryTmpDir, "instance-config.json"),
    templatesDir: defaultTemplatesDir(),
  });
  seedPortfolioTasks(this.buddyDir);
});

Given("WIP override for area {string} is null", function (this: WipOverridesWorld, area: string) {
  writeTaskWipOverrides({ [area]: null });
});

Given(
  "WIP override for area {string} is {int}",
  function (this: WipOverridesWorld, area: string, limit: number) {
    writeTaskWipOverrides({ [area]: limit });
  },
);

When("active fronts are computed and formatted with config", function (this: WipOverridesWorld) {
  const report = computeActiveFronts(root.call(this));
  const config = readTaskConfig();
  this.activeFrontsBlock = formatActiveFrontsBlock(report, config);
});

Then("the active fronts block contains {string}", function (this: WipOverridesWorld, text: string) {
  assert.ok(this.activeFrontsBlock, "activeFrontsBlock required");
  assert.ok(
    this.activeFrontsBlock.includes(text),
    `expected block to contain "${text}":\n${this.activeFrontsBlock}`,
  );
});

When(
  "tasks config sets WIP override for {string} to null",
  function (this: WipOverridesWorld, area: string) {
    const result = executeTaskAction(root.call(this), "config", {
      wipLimitOverrides: { [area]: null },
    });
    this.taskResultText = taskResultToText(result);
  },
);

Then(
  "tasks config response contains {string} with {string}",
  function (this: WipOverridesWorld, area: string, label: string) {
    assert.ok(this.taskResultText, "taskResultText required");
    assert.ok(
      this.taskResultText.includes(area) && this.taskResultText.includes(label),
      `expected response with "${area}" and "${label}": ${this.taskResultText}`,
    );
  },
);
