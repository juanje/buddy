// tests/steps/inline-file-viewer.steps.ts — FR-CHAT-10/11 inline file viewer BDD steps.
//
// Target contract (red until implemented):
//   routeLocalLinkClick(rootDir, href) → { type: "view"; relPath } | null
//   createFileViewerController({ readViewableFile }) — openFile(relPath)
// There is no "open" action and no openExternally: Buddy never hands a file to
// an external program (FR-CHAT-11).

import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";

import { createFileViewerController } from "../../src/lib/file-viewer-controller";
import { routeLocalLinkClick, type LocalLinkAction } from "../../src/lib/local-link-handler";

interface InlineFileViewerWorld {
  rootDir?: string;
  linkAction?: LocalLinkAction | null;
  fileContents?: Map<string, string>;
  fileViewer?: ReturnType<typeof createFileViewerController>;
}

/**
 * Cucumber's {string} hands back the characters between the quotes, so `\n` in
 * a feature file arrives as a backslash and an n. Scenarios that only compare
 * one literal against another never noticed; FR-CHAT-15 is about a block
 * delimited by real line breaks, so it does.
 */
function gherkinText(value: string): string {
  return value.replace(/\\n/g, "\n");
}

function readStore<T>(store: { subscribe: (fn: (value: T) => void) => () => void }): T {
  let value!: T;
  store.subscribe((next) => {
    value = next;
  })();
  return value;
}

Given("the buddy root directory is {string}", function (this: InlineFileViewerWorld, rootDir: string) {
  this.rootDir = rootDir;
  this.fileContents = new Map();
  this.fileViewer = createFileViewerController({
    // The frontend has no filesystem capability (NFR-SEC-09): content arrives
    // over worker RPC, keyed by a path relative to the buddy directory.
    readViewableFile: async (relPath: string) => {
      const content = this.fileContents?.get(relPath);
      if (content === undefined) {
        throw new Error(`File not found: ${relPath}`);
      }
      return content;
    },
  });
});

Given(
  "a readable file {string} with content {string}",
  function (this: InlineFileViewerWorld, relPath: string, content: string) {
    this.fileContents?.set(relPath, gherkinText(content));
  },
);

When("I click the local link {string}", function (this: InlineFileViewerWorld, href: string) {
  if (!this.rootDir) throw new Error("buddy root not initialized");
  this.linkAction = routeLocalLinkClick(this.rootDir, href);
});

When("the file viewer opens {string}", async function (this: InlineFileViewerWorld, relPath: string) {
  if (!this.fileViewer) throw new Error("file viewer not initialized");
  await this.fileViewer.openFile(relPath);
});

When("the file viewer is closed", function (this: InlineFileViewerWorld) {
  this.fileViewer?.close();
});

Then(
  "the link opens in the viewer with relative path {string}",
  function (this: InlineFileViewerWorld, relPath: string) {
    assert.equal(this.linkAction?.type, "view");
    assert.equal(this.linkAction?.relPath, relPath);
  },
);

Then("the link is rejected", function (this: InlineFileViewerWorld) {
  assert.equal(this.linkAction, null);
});

Then("the file viewer is open", function (this: InlineFileViewerWorld) {
  assert.equal(readStore(this.fileViewer!.open), true);
});

Then("the file viewer is not open", function (this: InlineFileViewerWorld) {
  assert.equal(readStore(this.fileViewer!.open), false);
});

Then("the file viewer shows path {string}", function (this: InlineFileViewerWorld, relPath: string) {
  assert.equal(readStore(this.fileViewer!.filePath), relPath);
});

Then("the file viewer shows file name {string}", function (this: InlineFileViewerWorld, name: string) {
  assert.equal(readStore(this.fileViewer!.fileName), name);
});

Then("the file viewer content is markdown", function (this: InlineFileViewerWorld) {
  assert.equal(readStore(this.fileViewer!.isMarkdown), true);
});

Then("the file viewer content is plain text", function (this: InlineFileViewerWorld) {
  assert.equal(readStore(this.fileViewer!.isMarkdown), false);
});

Then("the file viewer shows content {string}", function (this: InlineFileViewerWorld, content: string) {
  assert.equal(readStore(this.fileViewer!.content), gherkinText(content));
});

Then("the file viewer shows summary {string}", function (this: InlineFileViewerWorld, summary: string) {
  assert.equal(readStore(this.fileViewer!.summary), summary);
});

Then("the file viewer shows no summary", function (this: InlineFileViewerWorld) {
  assert.equal(readStore(this.fileViewer!.summary), undefined);
});

Then("the file viewer shows an error", function (this: InlineFileViewerWorld) {
  const error = readStore(this.fileViewer!.error);
  assert.ok(error && error.length > 0);
});

Then("the file viewer has no external-open action", function (this: InlineFileViewerWorld) {
  assert.ok(
    !("openExternally" in this.fileViewer!),
    "file viewer must not expose an external-open action (FR-CHAT-11)",
  );
});
