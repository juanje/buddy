// tests/steps/inline-file-viewer.steps.ts — FR-CHAT-10 inline file viewer BDD steps.

import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";

import { createFileViewerController } from "../../src/lib/file-viewer-controller";
import { routeLocalLinkClick, type LocalLinkAction } from "../../src/lib/local-link-handler";

interface InlineFileViewerWorld {
  rootDir?: string;
  linkAction?: LocalLinkAction | null;
  fileContents?: Map<string, string>;
  fileViewer?: ReturnType<typeof createFileViewerController>;
  openedExternally?: string[];
}

function readStore<T>(store: { subscribe: (fn: (value: T) => void) => () => void }): T {
  let value!: T;
  store.subscribe((next) => {
    value = next;
  })();
  return value;
}

Given("the AB root directory is {string}", function (this: InlineFileViewerWorld, rootDir: string) {
  this.rootDir = rootDir;
  this.fileContents = new Map();
  this.openedExternally = [];
  this.fileViewer = createFileViewerController({
    readTextFile: async (path) => {
      const content = this.fileContents?.get(path);
      if (content === undefined) {
        throw new Error(`ENOENT: no such file ${path}`);
      }
      return content;
    },
    openPath: async (path) => {
      this.openedExternally?.push(path);
    },
  });
});

Given(
  "a readable file {string} with content {string}",
  function (this: InlineFileViewerWorld, path: string, content: string) {
    this.fileContents?.set(path, content);
  },
);

When("I click the local link {string}", function (this: InlineFileViewerWorld, href: string) {
  if (!this.rootDir) throw new Error("AB root not initialized");
  this.linkAction = routeLocalLinkClick(this.rootDir, href);
});

When("the file viewer opens {string}", async function (this: InlineFileViewerWorld, path: string) {
  if (!this.fileViewer) throw new Error("file viewer not initialized");
  await this.fileViewer.openFile(path);
});

When("the file viewer is closed", function (this: InlineFileViewerWorld) {
  this.fileViewer?.close();
});

When("the file viewer opens externally", async function (this: InlineFileViewerWorld) {
  await this.fileViewer?.openExternally();
});

Then("the link action is {string}", function (this: InlineFileViewerWorld, action: string) {
  assert.equal(this.linkAction?.type, action);
});

Then("the resolved path is {string}", function (this: InlineFileViewerWorld, path: string) {
  assert.equal(this.linkAction?.absPath, path);
});

Then("the file viewer is open", function (this: InlineFileViewerWorld) {
  assert.equal(readStore(this.fileViewer!.open), true);
});

Then("the file viewer is not open", function (this: InlineFileViewerWorld) {
  assert.equal(readStore(this.fileViewer!.open), false);
});

Then("the file viewer shows path {string}", function (this: InlineFileViewerWorld, path: string) {
  assert.equal(readStore(this.fileViewer!.filePath), path);
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
  assert.equal(readStore(this.fileViewer!.content), content);
});

Then("the file viewer shows an error", function (this: InlineFileViewerWorld) {
  const error = readStore(this.fileViewer!.error);
  assert.ok(error && error.length > 0);
});

Then(
  "the system opener was called for {string}",
  function (this: InlineFileViewerWorld, path: string) {
    assert.deepEqual(this.openedExternally, [path]);
  },
);
