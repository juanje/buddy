// tests/steps/dashboard-viewer.steps.ts — FR-DASH-02 viewer integration.

import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { resolveViewableDashboard } from "../../backends/dashboard/viewable-dashboard";
import { writeTasksFile } from "../../backends/tasks/task-file";
import { createFileViewerController } from "../../src/lib/file-viewer-controller";
import { buildDashboardViewModel } from "../../src/lib/dashboard/view-model";
import type { ResolvedDashboard } from "../../shared/dashboard/types";
import type { BuddyWorld } from "../support/world";

interface DashViewerWorld extends BuddyWorld {
  rootDir?: string;
  fileContents?: Map<string, string>;
  fileViewer?: ReturnType<typeof createFileViewerController>;
  resolveError?: string;
}

function readStore<T>(store: { subscribe: (fn: (value: T) => void) => () => void }): T {
  let value!: T;
  store.subscribe((next) => {
    value = next;
  })();
  return value;
}

function gherkinText(value: string): string {
  return value.replace(/\\n/g, "\n");
}

Given("a filesystem buddy root at {string}", function (this: DashViewerWorld, rootDir: string) {
  this.rootDir = rootDir;
  this.fileContents = new Map();
  mkdirSync(rootDir, { recursive: true });
  this.fileViewer = createFileViewerController({
    readViewableFile: async (relPath: string) => {
      const content = this.fileContents?.get(relPath);
      if (content === undefined) throw new Error(`File not found: ${relPath}`);
      return content;
    },
    resolveDashboard: async (relPath: string) =>
      resolveViewableDashboard(this.rootDir!, relPath, "2026-10-07"),
    rootDir: () => this.rootDir ?? "",
    platformSupportsPdf: true,
  });
});

Given(
  "a readable file {string} with content:",
  function (this: DashViewerWorld, relPath: string, content: string) {
    const root = this.rootDir!;
    const abs = join(root, relPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, gherkinText(content), "utf8");
    this.fileContents?.set(relPath, gherkinText(content));
  },
);

Given("tasks.md exists at buddy root with one open task", function (this: DashViewerWorld) {
  writeTasksFile(
    this.rootDir!,
    [{ id: 1, text: "Do thing", done: false, next: true, area: "personal" }],
    "2026-10-07",
  );
});

Given("the user tasks file is a symlink outside the buddy root", function (this: DashViewerWorld) {
  const root = this.rootDir!;
  const outside = join(root, "..", "outside-tasks");
  mkdirSync(outside, { recursive: true });
  writeFileSync(
    join(outside, "tasks.md"),
    "---\ncreated: 2026-01-01\n---\n\n# Tasks\n\n- [ ] Outside",
    "utf8",
  );
  mkdirSync(join(root, "user"), { recursive: true });
  symlinkSync(join(outside, "tasks.md"), join(root, "user", "tasks.md"));
});

When("the dashboard test viewer opens {string}", async function (this: DashViewerWorld, relPath: string) {
  await this.fileViewer!.openFile(relPath);
});

When(
  "resolveDashboard is called for {string}",
  function (this: DashViewerWorld, relPath: string) {
    try {
      resolveViewableDashboard(this.rootDir!, relPath, "2026-10-07");
      this.resolveError = undefined;
    } catch (err) {
      this.resolveError = err instanceof Error ? err.message : String(err);
    }
  },
);

Then("the file viewer is in wide mode", function (this: DashViewerWorld) {
  assert.equal(readStore(this.fileViewer!.wide), true);
});

Then("the file viewer is not in wide mode", function (this: DashViewerWorld) {
  assert.equal(readStore(this.fileViewer!.wide), false);
});

Then("the file viewer layout is fullWindow", function (this: DashViewerWorld) {
  assert.equal(readStore(this.fileViewer!.layout), "fullWindow");
});

Then("the file viewer layout is modal", function (this: DashViewerWorld) {
  assert.equal(readStore(this.fileViewer!.layout), "modal");
});

Then("the file viewer header title is {string}", function (this: DashViewerWorld, title: string) {
  assert.equal(readStore(this.fileViewer!.headerTitle), title);
});

Then("the dashboard view model has no document title", function (this: DashViewerWorld) {
  const model = readStore(this.fileViewer!.dashboard) as ResolvedDashboard;
  const vm = buildDashboardViewModel(model, "es", "Sin datos");
  assert.deepEqual(Object.keys(vm).sort(), ["rows"]);
});

Then("the file viewer has a resolved dashboard", function (this: DashViewerWorld) {
  const model = readStore(this.fileViewer!.dashboard);
  assert.ok(model);
  assert.ok(model!.segments.length > 0);
});

Then("the file viewer has no resolved dashboard", function (this: DashViewerWorld) {
  assert.equal(readStore(this.fileViewer!.dashboard), undefined);
});

Then("the file viewer does not offer export PDF", function (this: DashViewerWorld) {
  assert.equal(readStore(this.fileViewer!.canExportPdf), false);
});

Then("the file viewer offers export PDF", function (this: DashViewerWorld) {
  assert.equal(readStore(this.fileViewer!.canExportPdf), true);
});

Then("resolveDashboard fails", function (this: DashViewerWorld) {
  assert.ok(this.resolveError);
});

Then(
  "the dashboard widget mentions escaping",
  function (this: DashViewerWorld) {
    const model = readStore(this.fileViewer!.dashboard) as ResolvedDashboard;
    const widget = model.segments.find((s) => s.kind === "widget");
    assert.equal(widget?.kind, "widget");
    if (widget?.kind === "widget") {
      assert.equal(widget.result.kind, "error");
      if (widget.result.kind === "error") {
        assert.match(widget.result.message, /escapes/i);
      }
    }
  },
);
