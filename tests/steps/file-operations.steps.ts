// tests/steps/file-operations.steps.ts — FR-DELETE-01, FR-FILE-01, FR-FILE-02 BDD.

import { After, Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { simpleGit } from "simple-git";

import {
  buildFileTools,
  executeFileTool,
  type FileToolOptions,
} from "../../backends/file-tools";
import type { AbWorld } from "../support/world";

interface FileOpsWorld extends AbWorld {
  fileOpsTmpDir?: string;
  externalTmpDir?: string;
  externalFilePath?: string;
  fileTools?: ReturnType<typeof buildFileTools>;
  lastToolError?: string;
  lastToolResult?: string;
  deleteConfirmed?: boolean;
  readAllowed?: boolean;
}

After(function (this: FileOpsWorld) {
  if (this.externalTmpDir) rmSync(this.externalTmpDir, { recursive: true, force: true });
});

function writeRepoFile(abDir: string, relPath: string, content: string): void {
  const abs = join(abDir, relPath);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, content);
}

Given("file tools are available", function (this: FileOpsWorld) {
  if (!this.abDir) throw new Error("buddy repository not initialized");

  const world = this;
  const options: FileToolOptions = {
    confirmDelete: async () => world.deleteConfirmed ?? true,
    askReadPermission: async () => world.readAllowed ?? true,
  };
  this.fileTools = buildFileTools(this.abDir, options);
});

Given(
  "a file {string} with content {string}",
  async function (this: FileOpsWorld, relPath: string, content: string) {
    if (!this.abDir) throw new Error("buddy repository not initialized");
    writeRepoFile(this.abDir, relPath, content);
    await simpleGit(this.abDir).add(relPath).commit(`add ${relPath}`);
  },
);

Given(
  "an external file {string} with content {string}",
  function (this: FileOpsWorld, absPath: string, content: string) {
    this.externalTmpDir = mkdtempSync(join(tmpdir(), "ab-fileops-ext-"));
    const target = join(this.externalTmpDir, absPath.replace(/^\/tmp\//, ""));
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, content);
    this.externalFilePath = target;
  },
);

When(
  "delete_file is called with path {string} and deletion is confirmed",
  async function (this: FileOpsWorld, path: string) {
    this.deleteConfirmed = true;
    await invokeDelete(this, path);
  },
);

When(
  "delete_file is called with path {string} and deletion is denied",
  async function (this: FileOpsWorld, path: string) {
    this.deleteConfirmed = false;
    await invokeDelete(this, path);
  },
);

When("delete_file is called with path {string}", async function (this: FileOpsWorld, path: string) {
  this.deleteConfirmed = true;
  await invokeDelete(this, path);
});

async function invokeDelete(world: FileOpsWorld, path: string): Promise<void> {
  if (!world.fileTools) throw new Error("file tools not initialized");
  try {
    world.lastToolResult = await executeFileTool(world.fileTools, "delete_file", { path });
    world.lastToolError = undefined;
  } catch (error) {
    world.lastToolError = error instanceof Error ? error.message : String(error);
    world.lastToolResult = undefined;
  }
}

When(
  "copy_file is called with source {string} and destination {string}",
  async function (this: FileOpsWorld, source: string, destination: string) {
    if (!this.fileTools) throw new Error("file tools not initialized");
    this.readAllowed = true;
    const resolvedSource = source.startsWith("/tmp/") && this.externalFilePath
      ? this.externalFilePath
      : source;
    try {
      this.lastToolResult = await executeFileTool(this.fileTools, "copy_file", {
        source: resolvedSource,
        destination,
      });
      this.lastToolError = undefined;
    } catch (error) {
      this.lastToolError = error instanceof Error ? error.message : String(error);
      this.lastToolResult = undefined;
    }
  },
);

When(
  "move_file is called with source {string} and destination {string}",
  async function (this: FileOpsWorld, source: string, destination: string) {
    if (!this.fileTools) throw new Error("file tools not initialized");
    try {
      this.lastToolResult = await executeFileTool(this.fileTools, "move_file", {
        source,
        destination,
      });
      this.lastToolError = undefined;
    } catch (error) {
      this.lastToolError = error instanceof Error ? error.message : String(error);
      this.lastToolResult = undefined;
    }
  },
);

Then("the delete tool result contains {string}", function (this: FileOpsWorld, expected: string) {
  assert.ok(
    this.lastToolResult?.includes(expected),
    `expected delete result to contain "${expected}", got:\n${this.lastToolResult ?? "(none)"}`,
  );
});

Then("the copy tool result contains {string}", function (this: FileOpsWorld, expected: string) {
  assert.ok(
    this.lastToolResult?.includes(expected),
    `expected copy result to contain "${expected}", got:\n${this.lastToolResult ?? "(none)"}`,
  );
});

Then("the move tool result contains {string}", function (this: FileOpsWorld, expected: string) {
  assert.ok(
    this.lastToolResult?.includes(expected),
    `expected move result to contain "${expected}", got:\n${this.lastToolResult ?? "(none)"}`,
  );
});

Then("the file tool returns an error containing {string}", function (this: FileOpsWorld, expected: string) {
  assert.ok(
    this.lastToolError?.includes(expected),
    `expected error to contain "${expected}", got: ${this.lastToolError ?? "(none)"}`,
  );
});

Then(
  "the file {string} contains {string}",
  function (this: FileOpsWorld, relPath: string, expected: string) {
    if (!this.abDir) throw new Error("buddy repository not initialized");
    const content = readFileSync(join(this.abDir, relPath), "utf8");
    assert.ok(content.includes(expected), `expected ${relPath} to contain "${expected}"`);
  },
);
