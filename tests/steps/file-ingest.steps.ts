// tests/steps/file-ingest.steps.ts — FR-INGEST-01..04.

import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createPermissionGate,
  type PermissionGate,
} from "../../backends/permissions";
import type { AbWorld } from "../support/world";

interface IngestWorld extends AbWorld {
  ingestTmpDir?: string;
  home?: string;
  abDir?: string;
  gate?: PermissionGate;
  sessionAllowedPaths?: Set<string>;
  readOutcome?: { block: true; reason: string } | undefined;
}

Given("the chat is connected", function (this: IngestWorld) {
  this.connect(undefined, { force: true });
});

When("I attach the file {string}", function (this: IngestWorld, path: string) {
  this.controller.addAttachments([path]);
});

When("I remove the attachment {string}", function (this: IngestWorld, path: string) {
  this.controller.removeAttachment(path);
});

Then("no attachment chips are shown", function (this: IngestWorld) {
  assert.equal(this.read(this.controller.attachments).length, 0);
});

Then("an attachment error is shown for {string}", function (this: IngestWorld, name: string) {
  const errors = this.read(this.controller.attachmentErrors);
  assert.ok(errors.includes(name), `expected error for ${name}, got ${JSON.stringify(errors)}`);
});

Then("the prompt includes {string}", function (this: IngestWorld, text: string) {
  const sent = this.session.promptCalls[this.session.promptCalls.length - 1];
  assert.ok(sent, "expected a prompt to have been sent");
  assert.ok(sent.includes(text), `prompt missing: ${text}\n${sent}`);
});

Then("the prompt does not include {string}", function (this: IngestWorld, text: string) {
  const sent = this.session.promptCalls[this.session.promptCalls.length - 1];
  assert.ok(sent, "expected a prompt to have been sent");
  assert.ok(!sent.includes(text), `prompt should not include: ${text}`);
});

Given("a permission layer with session-allowed paths", function (this: IngestWorld) {
  this.ingestTmpDir = mkdtempSync(join(tmpdir(), "ab-ingest-"));
  this.home = join(this.ingestTmpDir, "home");
  this.abDir = join(this.home, "buddy");
  this.sessionAllowedPaths = new Set<string>();
  this.gate = createPermissionGate(
    this.abDir,
    async () => {
      throw new Error("should not ask");
    },
    this.home,
    { sessionAllowedPaths: this.sessionAllowedPaths },
  );
});

When("the user attaches {string}", function (this: IngestWorld, path: string) {
  const expanded = path.startsWith("~/") ? join(this.home!, path.slice(2)) : path;
  this.sessionAllowedPaths!.add(expanded);
});

When("the agent reads the session-attached outside path {string}", async function (this: IngestWorld, path: string) {
  const expanded = path.startsWith("~/") ? join(this.home!, path.slice(2)) : path;
  this.readOutcome = await this.gate!.check("read", { path: expanded });
});

Then("the read is allowed silently", function (this: IngestWorld) {
  assert.equal(this.readOutcome, undefined);
});
