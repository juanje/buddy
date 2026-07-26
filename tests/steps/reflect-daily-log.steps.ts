// tests/steps/reflect-daily-log.steps.ts — FR-REFLECT daily log append + DD-3.

import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { commitAll } from "../../backends/git";
import { GIT_COMMIT_PREFIX } from "../../shared/defaults";
import {
  finalizeReflectToDailyLog,
  sanitizeReflectOutput,
  updateLogsIndexEntry,
} from "../../backends/reflect";
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
    await commitAll(this.abDir, `${GIT_COMMIT_PREFIX} session reflect`);
  },
);

When(
  "finalization runs with sanitized LLM output {string}",
  async function (this: ReflectDailyWorld, rawOutput: string) {
    assert.ok(this.abDir, "abDir should be set");
    assert.ok(this.finalizationDate, "finalization date should be set");
    assert.ok(this.finalizationHeader, "finalization header should be set");

    this.finalizationSections = sanitizeReflectOutput(rawOutput.replace(/\\n/g, "\n"));
    this.lastDailyLogPath = finalizeReflectToDailyLog({
      rootDir: this.abDir,
      sessionDate: this.finalizationDate,
      sessionHeader: this.finalizationHeader,
      sections: this.finalizationSections,
    });
    updateLogsIndexEntry(this.abDir, this.finalizationDate);
    await commitAll(this.abDir, `${GIT_COMMIT_PREFIX} session reflect`);
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

Given(
  "the logs index for {string} has curated summary {string}",
  function (this: ReflectDailyWorld, date: string, summary: string) {
    assert.ok(this.abDir, "abDir should be set");
    updateLogsIndexEntry(this.abDir, date, "active", summary);
  },
);

Then(
  "the daily log contains exactly {int} session heading",
  function (this: ReflectDailyWorld, count: number) {
    assert.ok(this.lastDailyLogPath, "daily log path should be set");
    const content = readFileSync(this.lastDailyLogPath, "utf8");
    const matches = content.match(/^## Session /gm) ?? [];
    assert.equal(
      matches.length,
      count,
      `expected ${count} session heading(s), found ${matches.length}`,
    );
  },
);

Then(
  "the logs index for {string} still has summary {string}",
  function (this: ReflectDailyWorld, date: string, summary: string) {
    const indexPath = join(this.abDir!, "logs", "index.md");
    assert.ok(existsSync(indexPath), `expected logs index at ${indexPath}`);
    const index = readFileSync(indexPath, "utf8");
    assert.ok(
      index.includes(`- ${date}: active — ${summary}`),
      `expected index to preserve curated summary "${summary}" for ${date}`,
    );
  },
);
