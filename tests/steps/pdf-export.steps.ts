// tests/steps/pdf-export.steps.ts — FR-CHAT-18 export viewed file as PDF.

import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";

import { createFileViewerController } from "../../src/lib/file-viewer-controller";
import { buildPdfHtml } from "../../src/lib/pdf-html";
import { createPdfSaver } from "../../src/lib/pdf-save-path";
import { platformSupportsPdf } from "../../src/lib/platform-support-pdf";

interface PdfExportWorld {
  rootDir?: string;
  userAgent?: string;
  fileContents?: Map<string, string>;
  fileViewer?: ReturnType<typeof createFileViewerController>;
  pdfHtml?: string;
  markdownBody?: string;
  saveCancelled?: boolean;
  savedPdfs?: Array<{ name: string; data: Uint8Array }>;
  downloadsDirectory?: string;
  homeDirectory?: string;
  nextConfirmedPath?: string | null;
  dialogDefaults?: string[];
  pdfSaver?: ReturnType<typeof createPdfSaver>;
}

function readStore<T>(store: { subscribe: (fn: (value: T) => void) => () => void }): T {
  let value!: T;
  store.subscribe((next) => {
    value = next;
  })();
  return value;
}

Given("PDF export is available", function (this: PdfExportWorld) {
  this.savedPdfs = [];
  this.saveCancelled = false;
  this.fileViewer = createFileViewerController({
    readViewableFile: async (relPath: string) => {
      const content = this.fileContents?.get(relPath);
      if (content === undefined) {
        throw new Error(`File not found: ${relPath}`);
      }
      return content;
    },
    rootDir: () => this.rootDir ?? "",
    platformSupportsPdf: true,
    createPdf: async () => new Uint8Array([1, 2, 3]),
    savePdf: async (name, data) => {
      if (this.saveCancelled) return;
      this.savedPdfs?.push({ name, data });
    },
  });
});

Given("the save dialog will be cancelled", function (this: PdfExportWorld) {
  this.saveCancelled = true;
});

Given("the browser user agent is {string}", function (this: PdfExportWorld, userAgent: string) {
  this.userAgent = userAgent;
});

When(
  "the file viewer opens {string} with native PDF platform detection",
  async function (this: PdfExportWorld, relPath: string) {
    const ua = this.userAgent ?? "";
    this.fileViewer = createFileViewerController({
      readViewableFile: async (path: string) => {
        const content = this.fileContents?.get(path);
        if (content === undefined) {
          throw new Error(`File not found: ${path}`);
        }
        return content;
      },
      rootDir: () => this.rootDir ?? "",
      platformSupportsPdf: platformSupportsPdf(ua),
    });
    await this.fileViewer.openFile(relPath);
  },
);

Given("markdown content {string}", function (this: PdfExportWorld, html: string) {
  this.markdownBody = html;
});

When("the PDF HTML is assembled", function (this: PdfExportWorld) {
  this.pdfHtml = buildPdfHtml(this.markdownBody ?? "");
});

When('I activate "Export PDF"', async function (this: PdfExportWorld) {
  if (!this.fileViewer) throw new Error("file viewer not initialized");
  await this.fileViewer.exportPdf();
});

Then('the "Export PDF" action is available', function (this: PdfExportWorld) {
  assert.equal(readStore(this.fileViewer!.canExportPdf), true);
});

Then('the "Export PDF" action is not available', function (this: PdfExportWorld) {
  assert.equal(readStore(this.fileViewer!.canExportPdf), false);
});

Then("the PDF HTML is a complete document with charset", function (this: PdfExportWorld) {
  const html = this.pdfHtml ?? "";
  assert.match(html, /<!DOCTYPE html>/i);
  assert.match(html, /charset="utf-8"/i);
});

Then("the PDF HTML has no CSS variables", function (this: PdfExportWorld) {
  assert.equal((this.pdfHtml ?? "").includes("var(--"), false);
});

Then("the PDF HTML contains the rendered body", function (this: PdfExportWorld) {
  assert.ok(this.pdfHtml?.includes(this.markdownBody ?? ""));
});

Then("the PDF HTML uses pt-based padding for A4 layout", function (this: PdfExportWorld) {
  const html = this.pdfHtml ?? "";
  assert.ok(html.includes("padding: 48pt 54pt"), "Expected pt-based padding");
  assert.ok(!html.includes("max-width: 520px"), "Should not use a centered max-width box");
});

Then("the PDF HTML avoids page breaks inside blocks", function (this: PdfExportWorld) {
  const html = this.pdfHtml ?? "";
  assert.match(html, /break-inside:\s*avoid/);
});

Then("no PDF file is written", function (this: PdfExportWorld) {
  assert.equal(this.savedPdfs?.length ?? 0, 0);
});

function pdfSaverFor(world: PdfExportWorld): ReturnType<typeof createPdfSaver> {
  if (!world.pdfSaver) {
    world.dialogDefaults = [];
    world.savedPdfs = world.savedPdfs ?? [];
    world.pdfSaver = createPdfSaver({
      downloadsDirectory: async () => {
        if (!world.downloadsDirectory) {
          throw new Error("operating system downloads directory was not set");
        }
        return world.downloadsDirectory;
      },
      homeDirectory: async () => {
        if (!world.homeDirectory) throw new Error("home directory was not set");
        return world.homeDirectory;
      },
      openDialog: async (defaultPath) => {
        world.dialogDefaults?.push(defaultPath);
        if (world.nextConfirmedPath === null || world.saveCancelled) return null;
        return world.nextConfirmedPath ?? defaultPath;
      },
      writeFile: async (path, data) => {
        world.savedPdfs?.push({ name: path, data });
      },
    });
  }
  return world.pdfSaver;
}

function resetPdfSaver(world: PdfExportWorld): void {
  world.pdfSaver = undefined;
  world.dialogDefaults = [];
  world.savedPdfs = [];
  world.nextConfirmedPath = undefined;
  world.saveCancelled = false;
}

Given(
  "the operating system downloads directory is {string}",
  function (this: PdfExportWorld, directory: string) {
    this.downloadsDirectory = directory;
    resetPdfSaver(this);
  },
);

Given("the operating system has no downloads directory", function (this: PdfExportWorld) {
  this.downloadsDirectory = undefined;
  resetPdfSaver(this);
});

Given("the home directory is {string}", function (this: PdfExportWorld, directory: string) {
  this.homeDirectory = directory;
});

Given(
  "the next PDF save will be confirmed at {string}",
  function (this: PdfExportWorld, savedPath: string) {
    this.nextConfirmedPath = savedPath;
  },
);

Given("the next PDF save will be cancelled", function (this: PdfExportWorld) {
  this.nextConfirmedPath = null;
});

When(
  "a PDF save is offered for {string}",
  async function (this: PdfExportWorld, fileName: string) {
    await pdfSaverFor(this).save(fileName, new Uint8Array([1]));
  },
);

Then("the save dialog default path is {string}", function (this: PdfExportWorld, expected: string) {
  const offered = this.dialogDefaults ?? [];
  assert.equal(offered[offered.length - 1], expected);
});

Then(
  "the first save dialog default path was {string}",
  function (this: PdfExportWorld, expected: string) {
    assert.equal(this.dialogDefaults?.[0], expected);
  },
);

Then("the save dialog default path is not a bare filename", function (this: PdfExportWorld) {
  const offered = this.dialogDefaults?.[this.dialogDefaults.length - 1] ?? "";
  assert.ok(offered.includes("/"), `expected a directory in ${offered}`);
});
