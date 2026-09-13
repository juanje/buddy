// tests/steps/file-viewer-reveal.steps.ts — FR-CHAT-20 reveal in file manager.

import { Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";

import { createFileViewerController } from "../../src/lib/file-viewer-controller";

interface RevealWorld {
  fileViewer?: ReturnType<typeof createFileViewerController>;
  revealedPaths?: string[];
}

function readStore<T>(store: { subscribe: (fn: (value: T) => void) => () => void }): T {
  let value!: T;
  store.subscribe((next) => {
    value = next;
  })();
  return value;
}

Then('the "Show in folder" action is available', function (this: RevealWorld) {
  assert.equal(readStore(this.fileViewer!.canReveal), true);
});

Then('the "Show in folder" action is not available', function (this: RevealWorld) {
  assert.equal(readStore(this.fileViewer!.canReveal), false);
});

When('I activate "Show in folder"', async function (this: RevealWorld) {
  if (!this.fileViewer) throw new Error("file viewer not initialized");
  await this.fileViewer.reveal();
});

Then(
  "revealItemInDir is called with {string}",
  function (this: RevealWorld, absPath: string) {
    assert.deepEqual(this.revealedPaths, [absPath]);
  },
);
