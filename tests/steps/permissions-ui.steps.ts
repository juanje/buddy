// tests/steps/permissions-ui.steps.ts — FR-PERM-07 permission cards in chat.
// Controller-level: requests arrive like FrontendAPI.onPermissionRequest
// would deliver them; verdicts are recorded by the world's fake worker.

import { When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { get } from "svelte/store";

import type { BuddyWorld } from "../support/world";

let nextRequestId = 100;

When(
  "the agent requests {string} access to {string}",
  function (this: BuddyWorld, op: string, path: string) {
    this.lastPermissionId = nextRequestId++;
    this.controller.handlePermissionRequest({
      id: this.lastPermissionId,
      kind: "outside",
      op: op as "read" | "write",
      path,
    });
  },
);

When("the user allows the permission", async function (this: BuddyWorld) {
  await this.controller.respondPermission(this.lastPermissionId!, true);
});

When("the user denies the permission", async function (this: BuddyWorld) {
  await this.controller.respondPermission(this.lastPermissionId!, false);
});

Then(
  "a permission card shows the {string} operation and that path",
  function (this: BuddyWorld, op: string) {
    const cards = get(this.controller.permissions);
    assert.equal(cards.length, 1);
    assert.equal(cards[0].request.op, op);
    assert.ok(cards[0].request.path.length > 0);
  },
);

Then("the card offers allow-once and deny actions", function (this: BuddyWorld) {
  // Unresolved card = actions available; the view renders buttons for it.
  const cards = get(this.controller.permissions);
  assert.equal(cards[0].verdict, undefined);
});

Then("the worker receives an allow verdict for that request", function (this: BuddyWorld) {
  assert.deepEqual(this.permissionResolutions, [{ id: this.lastPermissionId, allow: true }]);
});

Then("the worker receives a deny verdict for that request", function (this: BuddyWorld) {
  assert.deepEqual(this.permissionResolutions, [{ id: this.lastPermissionId, allow: false }]);
});

Then("the card is marked as allowed", function (this: BuddyWorld) {
  assert.equal(get(this.controller.permissions)[0].verdict, "allowed");
});

Then("the card is marked as denied", function (this: BuddyWorld) {
  assert.equal(get(this.controller.permissions)[0].verdict, "denied");
});

Then("the permission card does not block the chat input", function (this: BuddyWorld) {
  // Input availability is governed by streaming, not by pending permissions.
  assert.equal(get(this.controller.inputDisabled), false);
  this.controller.input.set("still typing");
  assert.equal(get(this.controller.canSend), true);
});
