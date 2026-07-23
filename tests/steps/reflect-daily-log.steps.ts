// tests/steps/reflect-daily-log.steps.ts — FR-REFLECT daily log append + DD-3.

import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { commitAll } from "../../backends/git";
import { findPendingReflects, finalizeReflectToDailyLog, savePendingSkeleton, updateLogsIndexEntry } from "../../backends/reflect";
import { runCrashRecoveryCatchUp } from "../../backends/reflect-recovery";
import { SessionTracker } from "../../backends/session-tracker";
import { MOCK_SPAWN_PID } from "../support/test-constants";
import type { AbWorld } from "../support/world";

interface ReflectDailyWorld extends AbWorld {
  abDir?: string;
  lastSkeletonDate?: string;
  lastDailyLogPath?: string;
}

function parseLocalDateTime(iso: string): Date {
  const [datePart, timePart] = iso.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0);
}

Given(
  "a pending reflect skeleton from a session starting {string} ending {string}",
  function (this: ReflectDailyWorld, start: string, end: string) {
    const startDate = parseLocalDateTime(start);
    const endDate = parseLocalDateTime(end);
    const tracker = new SessionTracker("crossmid", startDate);
    tracker.filesWritten.push("user/inbox.md");
    savePendingSkeleton(this.abDir!, tracker.toSnapshot(endDate));
    this.lastSkeletonDate = findPendingReflects(this.abDir!)[0]?.date;
  },
);

When("catch-up reflect runs", async function (this: ReflectDailyWorld) {
  const pending = findPendingReflects(this.abDir!);
  assert.ok(pending.length > 0, "expected a pending skeleton before catch-up");
  this.lastSkeletonDate = pending[0].date;

  runCrashRecoveryCatchUp(this.abDir!, (options) => {
    const skeleton = readFileSync(options.logPath, "utf8");
    finalizeReflectToDailyLog({
      rootDir: options.rootDir,
      skeletonPath: options.logPath,
      skeletonContent: skeleton,
      sections: "### Context\nCatch-up reflect for BDD.",
    });
    return MOCK_SPAWN_PID;
  });

  if (this.lastSkeletonDate) {
    updateLogsIndexEntry(this.abDir!, this.lastSkeletonDate);
  }
  await commitAll(this.abDir!, "ab: catch-up reflect");

  if (this.lastSkeletonDate) {
    this.lastDailyLogPath = join(this.abDir!, "logs", `${this.lastSkeletonDate}.md`);
  }
});

Then(
  "no files exist in {string} except {string}",
  function (this: ReflectDailyWorld, relDir: string, allowed: string) {
    const dir = join(this.abDir!, relDir.replace(/\/$/, ""));
    assert.ok(existsSync(dir), `${relDir} should exist`);
    const files = readdirSync(dir);
    const allowedNames = new Set([allowed, "archive"]);
    const unexpected = files.filter((f) => !allowedNames.has(f));
    assert.deepEqual(
      unexpected,
      [],
      `expected only ${[...allowedNames].join(", ")} in ${relDir}, got: ${files.join(", ")}`,
    );
  },
);

Then("a daily log exists for the skeleton's date", function (this: ReflectDailyWorld) {
  assert.ok(this.lastSkeletonDate, "skeleton date should be set");
  const path = join(this.abDir!, "logs", `${this.lastSkeletonDate}.md`);
  assert.ok(existsSync(path), `expected daily log at ${path}`);
  this.lastDailyLogPath = path;
});

Then("the daily log contains a session header", function (this: ReflectDailyWorld) {
  const path =
    this.lastDailyLogPath ??
    join(this.abDir!, "logs", `${this.lastSkeletonDate}.md`);
  const content = readFileSync(path, "utf8");
  assert.match(content, /## Session \d{2}:\d{2}–\d{2}:\d{2}/);
});

Then("the pending skeleton is deleted", function (this: ReflectDailyWorld) {
  assert.equal(findPendingReflects(this.abDir!).length, 0);
});

Then("a daily log exists for {string}", function (this: ReflectDailyWorld, date: string) {
  const path = join(this.abDir!, "logs", `${date}.md`);
  assert.ok(existsSync(path), `expected daily log at ${path}`);
  this.lastDailyLogPath = path;
  this.lastSkeletonDate = date;
});

Then("no daily log exists for {string}", function (this: ReflectDailyWorld, date: string) {
  const path = join(this.abDir!, "logs", `${date}.md`);
  assert.equal(existsSync(path), false, `expected no daily log at ${path}`);
});
