// tests/steps/file-ingest.steps.ts — FR-INGEST-01..04.

import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createMinimalPdf } from "../support/minimal-pdf";

import {
  createPermissionGate,
  type PermissionGate,
} from "../../backends/permissions";
import type { BuddyWorld } from "../support/world";

interface IngestWorld extends BuddyWorld {
  ingestTmpDir?: string;
  home?: string;
  buddyDir?: string;
  gate?: PermissionGate;
  sessionAllowedPaths?: Set<string>;
  readOutcome?: { block: true; reason: string } | undefined;
}

Given("the chat is connected", function (this: IngestWorld) {
  this.connect(undefined, { force: true });
});

Given(
  "a PDF file exists at {string} with text {string}",
  function (this: IngestWorld, path: string, text: string) {
    writeFileSync(path, createMinimalPdf(text));
  },
);

When("I attach the file {string}", function (this: IngestWorld, path: string) {
  this.controller.addAttachments([path]);
});

When("I remove the attachment {string}", function (this: IngestWorld, path: string) {
  this.controller.removeAttachment(path);
});

Then("the attachment is accepted", function (this: IngestWorld) {
  assert.equal(this.read(this.controller.attachmentErrors).length, 0);
  assert.equal(this.read(this.controller.attachments).length, 1);
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
  this.ingestTmpDir = mkdtempSync(join(tmpdir(), "buddy-ingest-"));
  this.home = join(this.ingestTmpDir, "home");
  this.buddyDir = join(this.home, "buddy");
  this.sessionAllowedPaths = new Set<string>();
  this.gate = createPermissionGate(
    this.buddyDir,
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
