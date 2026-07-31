// tests/steps/hebbian-tracking.steps.ts — FR-HEBB Hebbian access tracking.

import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { parseFrontmatter } from "../../shared/frontmatter";
import { toIsoDay } from "../../shared/dates";
import type { BuddyWorld } from "../support/world";

interface HebbWorld extends BuddyWorld {
  buddyDir?: string;
}

function writeTrackedFile(
  buddyDir: string,
  relPath: string,
  accessCount: number,
  scope: "brain" | "user",
): void {
  const fullPath = join(buddyDir, relPath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(
    fullPath,
    `---\naccess_count: ${accessCount}\nlast_accessed: 2026-01-01\ncreated: 2026-01-01\n---\n\n# ${scope} file\n`,
    "utf8",
  );
}

Given(
  "a tracked brain file {string} with access_count {int}",
  function (this: HebbWorld, relPath: string, accessCount: number) {
    writeTrackedFile(this.buddyDir!, relPath, accessCount, "brain");
  },
);

Given(
  "a tracked user file {string} with access_count {int}",
  function (this: HebbWorld, relPath: string, accessCount: number) {
    writeTrackedFile(this.buddyDir!, relPath, accessCount, "user");
  },
);

When("the agent reads file {string}", async function (this: HebbWorld, relPath: string) {
  const fullPath = join(this.buddyDir!, relPath);
  this.session.emitToolExecutionEnd("read", fullPath);
  await this.lifecycle?.flush();
});

Then("{string} has access_count {int}", function (this: HebbWorld, relPath: string, expected: number) {
  const content = readFileSync(join(this.buddyDir!, relPath), "utf8");
  const fields = parseFrontmatter(content);
  assert.equal(Number.parseInt(fields.access_count, 10), expected, content);
});

Then("{string} was accessed today", function (this: HebbWorld, relPath: string) {
  const content = readFileSync(join(this.buddyDir!, relPath), "utf8");
  const fields = parseFrontmatter(content);
  assert.equal(fields.last_accessed, toIsoDay(new Date()), content);
});
