// tests/steps/reflect-daily-log.steps.ts — FR-REFLECT daily log append + DD-3.

import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { commitAll } from "../../backends/git";
import { finalizeReflectToDailyLog, updateLogsIndexEntry } from "../../backends/reflect";
import type { AbWorld } from "../support/world";

interface ReflectDailyWorld extends AbWorld {
  abDir?: string;
  finalizationDate?: string;
  finalizationHeader?: string;
  finalizationSections?: string;
  lastDailyLogPath?: string;
}

Given(
  "a reflect finalization with date {string} and header {string}",
  function (this: ReflectDailyWorld, date: string, header: string) {
    this.finalizationDate = date;
    this.finalizationHeader = header;
  },
);

When(
  "finalization runs with sections {string}",
  async function (this: ReflectDailyWorld, sections: string) {
    assert.ok(this.abDir, "abDir should be set");
    assert.ok(this.finalizationDate, "finalization date should be set");
    assert.ok(this.finalizationHeader, "finalization header should be set");

    this.finalizationSections = sections.replace(/\\n/g, "\n");
    this.lastDailyLogPath = finalizeReflectToDailyLog({
      rootDir: this.abDir,
      sessionDate: this.finalizationDate,
      sessionHeader: this.finalizationHeader,
      sections: this.finalizationSections,
    });
    updateLogsIndexEntry(this.abDir, this.finalizationDate);
    await commitAll(this.abDir, "ab: session reflect");
  },
);

Then(
  "the daily log contains heading {string}",
  function (this: ReflectDailyWorld, heading: string) {
    assert.ok(this.lastDailyLogPath, "daily log path should be set");
    const content = readFileSync(this.lastDailyLogPath, "utf8");
    assert.ok(content.includes(heading), `expected heading ${heading} in daily log`);
  },
);

Then("a daily log exists for {string}", function (this: ReflectDailyWorld, date: string) {
  const path = join(this.abDir!, "logs", `${date}.md`);
  assert.ok(existsSync(path), `expected daily log at ${path}`);
  this.lastDailyLogPath = path;
});

Then("no daily log exists for {string}", function (this: ReflectDailyWorld, date: string) {
  const path = join(this.abDir!, "logs", `${date}.md`);
  assert.equal(existsSync(path), false, `expected no daily log at ${path}`);
});
