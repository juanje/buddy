// tests/steps/data-tool.steps.ts — FR-DATA-02

import { DataTable, Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { executeDataAction, type DataActionResult } from "../../backends/data/data-tool-actions";
import { countRegistrySectionsNamed } from "../../shared/data/registry";
import type { BuddyWorld } from "../support/world";

interface DataToolWorld extends BuddyWorld {
  buddyDir?: string;
  dataToolResult?: DataActionResult;
}

function root(this: DataToolWorld): string {
  assert.ok(this.buddyDir, "buddyDir required");
  return this.buddyDir;
}

When("data action {string} is invoked", function (this: DataToolWorld, action: string) {
  this.dataToolResult = executeDataAction(root.call(this), action);
});

When(
  "data action {string} is invoked with:",
  function (this: DataToolWorld, action: string, table: DataTable) {
    const params = table.rowsHash() as Record<string, string>;
    this.dataToolResult = executeDataAction(root.call(this), action, params);
  },
);

Then("data tool succeeded", function (this: DataToolWorld) {
  assert.ok(this.dataToolResult?.ok);
});

Then("data tool failed", function (this: DataToolWorld) {
  assert.equal(this.dataToolResult?.ok, false);
});

Then("data tool output mentions {string}", function (this: DataToolWorld, fragment: string) {
  assert.ok(this.dataToolResult?.text.includes(fragment), this.dataToolResult?.text);
});

Then("data file {string} exists", function (this: DataToolWorld, rel: string) {
  assert.ok(existsSync(join(root.call(this), rel)));
});

Then("data file {string} does not exist", function (this: DataToolWorld, rel: string) {
  assert.ok(!existsSync(join(root.call(this), rel)));
});

Then(
  "data file {string} contains {string}",
  function (this: DataToolWorld, rel: string, fragment: string) {
    const text = readFileSync(join(root.call(this), rel), "utf8");
    assert.ok(text.includes(fragment), text);
  },
);

Then(
  "data file {string} does not contain {string}",
  function (this: DataToolWorld, rel: string, fragment: string) {
    const text = readFileSync(join(root.call(this), rel), "utf8");
    assert.ok(!text.includes(fragment), text);
  },
);

Then(
  "data registry file has one section named {string}",
  function (this: DataToolWorld, name: string) {
    const text = readFileSync(join(root.call(this), "user/data/index.md"), "utf8");
    assert.equal(countRegistrySectionsNamed(text, name), 1);
  },
);
