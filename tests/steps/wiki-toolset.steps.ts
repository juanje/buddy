// tests/steps/wiki-toolset.steps.ts — FR-WIKI-07 tool registration BDD.

import { Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";

import { buildAgentToolset } from "../../backends/session-boot";
import type { BuddyWorld } from "../support/world";

interface WikiToolsetWorld extends BuddyWorld {
  buddyDir?: string;
  toolNames?: string[];
  customToolNames?: string[];
}

When("the agent toolset is built for the buddy", function (this: WikiToolsetWorld) {
  assert.ok(this.buddyDir, "buddyDir must be set");
  const toolset = buildAgentToolset(this.buddyDir, {
    requestPermission: async () => true,
    showFile: () => {},
  });
  this.toolNames = toolset.names;
  this.customToolNames = toolset.customTools.map((tool) => tool.name);
});

Then("the toolset offers wiki_search", function (this: WikiToolsetWorld) {
  assert.ok(this.toolNames?.includes("wiki_search"));
});

Then("the toolset offers wiki_file", function (this: WikiToolsetWorld) {
  assert.ok(this.toolNames?.includes("wiki_file"));
});

Then("the toolset registers wiki_search", function (this: WikiToolsetWorld) {
  assert.ok(this.customToolNames?.includes("wiki_search"));
});

Then("the toolset registers wiki_file", function (this: WikiToolsetWorld) {
  assert.ok(this.customToolNames?.includes("wiki_file"));
});
