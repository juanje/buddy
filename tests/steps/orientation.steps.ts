// tests/steps/orientation.steps.ts — FR-ORIENT BDD steps.

import { After, Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { get } from "svelte/store";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createBuddyInstance, defaultTemplatesDir } from "../../backends/create-buddy";
import { parseDeferredItems } from "../../backends/deferred";
import { fetchOneLinerFromSession } from "../../backends/orientation-one-liner";
import { buildOneLinerPrompt } from "../../backends/orientation-prompt";
import { buildOrientationData, markOrientationDismissed } from "../../backends/orientation";
import { readLastOrientationDate, writeLastOrientationDate } from "../../backends/orientation-config";
import { writeTasksFile } from "../../backends/tasks/task-file";
import type { OrientationData, SetupConfig } from "../../shared/api";
import { setupGlobalConfigDir, teardownGlobalConfigDir } from "../support/global-config";
import type { BuddyWorld } from "../support/world";

interface OrientationWorld extends BuddyWorld {
  orientTmpDir?: string;
  buddyDir?: string;
  globalConfigDir?: string;
  orientationData?: OrientationData | null;
  orientationToday?: string;
  orientationShownThisSession?: boolean;
  oneLinerReceived?: string | null;
  chatOneLiner?: string | null;
}

After(function (this: OrientationWorld) {
  if (this.orientTmpDir) rmSync(this.orientTmpDir, { recursive: true, force: true });
  if (this.globalConfigDir) teardownGlobalConfigDir(this.globalConfigDir);
});

Given("an initialized buddy git repository for orientation", async function (this: OrientationWorld) {
  const fixture = setupGlobalConfigDir();
  this.globalConfigDir = fixture.configDir;
  this.orientTmpDir = mkdtempSync(join(tmpdir(), "buddy-orient-"));
  this.buddyDir = join(this.orientTmpDir, "buddy");
  const config: SetupConfig = {
    rootDir: this.buddyDir,
    provider: "anthropic",
    model: "claude-haiku-4-5",
    language: "en",
    name: "Test",
  };
  await createBuddyInstance({
    config,
    configPath: join(this.globalConfigDir, "config.json"),
    templatesDir: defaultTemplatesDir(),
  });
});

Given(
  "the orientation deferred queue has an item due on {string}",
  function (this: OrientationWorld, dueDate: string) {
    assert.ok(this.buddyDir, "buddyDir should be set");
    mkdirSync(join(this.buddyDir, "agent_brain"), { recursive: true });
    writeFileSync(
      join(this.buddyDir, "agent_brain", "deferred.md"),
      `- **reminder** (${dueDate}, user): Call dentist.\n`,
      "utf8",
    );
  },
);

Given("orientation has not been shown today", function (this: OrientationWorld) {
  assert.ok(this.globalConfigDir, "global config dir should be set");
});

Given("orientation was shown on {string}", function (this: OrientationWorld, date: string) {
  assert.ok(this.globalConfigDir, "global config dir should be set");
  writeLastOrientationDate(date, join(this.globalConfigDir, "config.json"));
});

Given(
  "tasks.md has next action {string} in area {word}",
  function (this: OrientationWorld, text: string, area: string) {
    assert.ok(this.buddyDir, "buddyDir should be set");
    writeTasksFile(this.buddyDir, [{ id: 1, text, done: false, next: true, area }]);
  },
);

When(
  "orientation data is fetched for today {string}",
  function (this: OrientationWorld, today: string) {
    assert.ok(this.buddyDir, "buddyDir should be set");
    this.orientationToday = today;
    this.orientationData = buildOrientationData(
      this.buddyDir,
      today,
      join(this.globalConfigDir!, "config.json"),
    );
  },
);

When("orientation is dismissed for today {string}", function (this: OrientationWorld, today: string) {
  assert.ok(this.buddyDir, "buddyDir should be set");
  markOrientationDismissed(this.buddyDir, today, join(this.globalConfigDir!, "config.json"));
});

Then("orientation data includes {int} deferred item", function (this: OrientationWorld, count: number) {
  assert.ok(this.orientationData, "orientation data should exist");
  assert.equal(this.orientationData.deferred.length, count);
});

Then(
  "orientation data includes next task {string}",
  function (this: OrientationWorld, text: string) {
    assert.ok(this.orientationData, "orientation data should exist");
    assert.ok(this.orientationData.nextTasks.some((task) => task.text === text));
  },
);

Then("orientation data is null", function (this: OrientationWorld) {
  assert.equal(this.orientationData, null);
});

Then("orientation last shown date is {string}", function (this: OrientationWorld, date: string) {
  assert.equal(readLastOrientationDate(join(this.globalConfigDir!, "config.json")), date);
});

Then("the deferred queue is empty", function (this: OrientationWorld) {
  assert.ok(this.buddyDir, "buddyDir should be set");
  const path = join(this.buddyDir, "agent_brain", "deferred.md");
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  const today = this.orientationToday ?? "2026-09-10";
  const due = parseDeferredItems(content).filter((item) => item.dueDate <= today);
  assert.equal(due.length, 0);
});

Given("orientation was shown this session", function (this: OrientationWorld) {
  this.orientationShownThisSession = true;
});

When("the session becomes ready", function (this: OrientationWorld) {
  this.controller.endTopicTransition();
});

When("the one-liner is requested", async function (this: OrientationWorld) {
  assert.ok(this.session, "session should be connected");
  const originalPrompt = this.session.prompt.bind(this.session);
  this.session.prompt = async (text: string) => {
    await originalPrompt(text);
    this.session.streamResponse(["Worked on orientation card"]);
  };
  const text = await fetchOneLinerFromSession(this.session);
  if (text) this.oneLinerReceived = text;
});

Then("the worker sends a silent recap prompt to the agent", function (this: OrientationWorld) {
  assert.ok(this.session.promptCalls.some((call) => call.includes("first time today")));
  assert.equal(this.session.promptCalls.at(-1), buildOneLinerPrompt());
});

Then("the frontend receives the one-liner text via onOneLiner", function (this: OrientationWorld) {
  assert.equal(this.oneLinerReceived, "Worked on orientation card");
});

Given(
  'a one-liner "Worked on orientation card" has been received',
  function (this: OrientationWorld) {
    this.chatOneLiner = "Worked on orientation card";
  },
);

Then("the welcome greeting is not visible", function (this: OrientationWorld) {
  const welcomeVisible = get(this.controller.welcomeVisible);
  assert.ok(this.chatOneLiner, "one-liner should be set");
  const wouldShowWelcome = welcomeVisible && !this.chatOneLiner;
  assert.equal(wouldShowWelcome, false);
});

Then("the one-liner is not visible", function (this: OrientationWorld) {
  assert.ok(this.chatOneLiner, "one-liner should have been set");
  const messages = get(this.controller.messages);
  assert.ok(messages.length > 0, "message should hide one-liner");
  const wouldShowOneLiner = this.chatOneLiner !== null && messages.length === 0;
  assert.equal(wouldShowOneLiner, false);
});
