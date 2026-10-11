// tests/steps/data-registry.steps.ts — FR-DATA-01

import { Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";

import { parseDataRegistryDocument, type ParseDataRegistryResult } from "../../shared/data/registry";
import type { BuddyWorld } from "../support/world";

interface DataRegistryWorld extends BuddyWorld {
  parsedRegistry?: ParseDataRegistryResult;
  permOutcome?: { block: true; reason: string } | undefined;
}

When("the data registry document is parsed:", function (this: DataRegistryWorld, doc: string) {
  this.parsedRegistry = parseDataRegistryDocument(doc.trim());
});

Then(
  'the parsed data registry has {int} entries named {string} and {string}',
  function (this: DataRegistryWorld, count: number, a: string, b: string) {
    assert.ok(this.parsedRegistry, "parsedRegistry missing");
    assert.equal(this.parsedRegistry.entries.length, count);
    const names = this.parsedRegistry.entries.map((e) => e.name);
    assert.deepEqual(names.sort(), [a, b].sort());
  },
);

Then("the parsed data registry errors mention {string}", function (this: DataRegistryWorld, fragment: string) {
  assert.ok(this.parsedRegistry, "parsedRegistry missing");
  const hit = this.parsedRegistry.errors.some((e) => e.name === fragment || e.message.includes(fragment));
  assert.ok(hit, JSON.stringify(this.parsedRegistry.errors));
});

Then("the permission gate blocks with data registry message", function (this: DataRegistryWorld) {
  assert.ok(this.permOutcome?.block, "expected the tool call to be blocked");
  assert.match(this.permOutcome?.reason ?? "", /data\(action='define'\)/);
});

Then("the permission gate blocks with registered data message", function (this: DataRegistryWorld) {
  assert.ok(this.permOutcome?.block, "expected the tool call to be blocked");
  assert.match(this.permOutcome?.reason ?? "", /data\(action='append'\)/);
});

Then("the permission gate allows the write", function (this: DataRegistryWorld) {
  assert.equal(this.permOutcome, undefined);
});
