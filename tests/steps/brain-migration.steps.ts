// tests/steps/brain-migration.steps.ts — FR-BRAIN-08: USER.md section scaffolding BDD steps.

import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ensureUserMdSectionsOnDisk } from "../../backends/brain-migration";
import { setupGlobalConfigDir } from "../support/global-config";

interface BrainMigrationWorld {
  buddyDir?: string;
  userMdBefore?: string;
}

function userMdPath(buddyDir: string): string {
  return join(buddyDir, "agent_brain", "identity", "USER.md");
}

function readUserMd(buddyDir: string): string {
  return readFileSync(userMdPath(buddyDir), "utf8");
}

Given(
  "a USER.md with only About and Context sections",
  function (this: BrainMigrationWorld) {
    if (!this.buddyDir) throw new Error("buddy root not initialized");
    const content = `# User profile

## About

- **Name:** Test User
- **What you do:** Testing

## Context

Using buddy for tests.
`;
    const path = userMdPath(this.buddyDir);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, content);
    this.userMdBefore = content;
  },
);

Given(
  "a USER.md that already contains {string}",
  function (this: BrainMigrationWorld, heading: string) {
    if (!this.buddyDir) throw new Error("buddy root not initialized");
    const content = `# User profile

## About

- **Name:** Test User

${heading}

Existing content.

## Context

Some context.
`;
    const path = userMdPath(this.buddyDir);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, content);
    this.userMdBefore = content;
  },
);

When("ensureUserMdSections runs", function (this: BrainMigrationWorld) {
  if (!this.buddyDir) throw new Error("buddy root not initialized");
  ensureUserMdSectionsOnDisk(this.buddyDir);
});

When("ensureUserMdSections runs twice", function (this: BrainMigrationWorld) {
  if (!this.buddyDir) throw new Error("buddy root not initialized");
  ensureUserMdSectionsOnDisk(this.buddyDir);
  ensureUserMdSectionsOnDisk(this.buddyDir);
});

When("the session boots", function (this: BrainMigrationWorld) {
  if (!this.buddyDir) throw new Error("buddy root not initialized");
  ensureUserMdSectionsOnDisk(this.buddyDir);
});

Given("the bundled consolidation skill is deployed", function (this: BrainMigrationWorld) {
  if (!this.buddyDir) throw new Error("buddy root not initialized");
  const realSkill = readFileSync(
    join(process.cwd(), "bundled", "prompts", "consolidation.md"),
    "utf8",
  );
  setupGlobalConfigDir({ consolidationSkill: realSkill });
});

Then(
  "USER.md contains a {string} section",
  function (this: BrainMigrationWorld, heading: string) {
    if (!this.buddyDir) throw new Error("buddy root not initialized");
    const content = readUserMd(this.buddyDir);
    assert.ok(
      content.includes(heading),
      `USER.md should contain "${heading}" but got:\n${content}`,
    );
  },
);

Then("the original content is preserved", function (this: BrainMigrationWorld) {
  if (!this.buddyDir) throw new Error("buddy root not initialized");
  const content = readUserMd(this.buddyDir);
  assert.ok(content.includes("Test User"), "name should be preserved");
  assert.ok(content.includes("## About"), "About section should be preserved");
  assert.ok(content.includes("## Context"), "Context section should be preserved");
});

Then("USER.md is unchanged", function (this: BrainMigrationWorld) {
  if (!this.buddyDir) throw new Error("buddy root not initialized");
  const content = readUserMd(this.buddyDir);
  assert.equal(content, this.userMdBefore);
});

Then(
  "USER.md contains exactly one {string} section",
  function (this: BrainMigrationWorld, heading: string) {
    if (!this.buddyDir) throw new Error("buddy root not initialized");
    const content = readUserMd(this.buddyDir);
    const count = (content.match(new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length;
    assert.equal(count, 1, `expected exactly one "${heading}", found ${count}`);
  },
);
