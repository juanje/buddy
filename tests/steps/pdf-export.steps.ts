// tests/steps/pdf-export.steps.ts — FR-CHAT-18 export viewed file as PDF.

import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";

import { createFileViewerController } from "../../src/lib/file-viewer-controller";
import { buildPdfHtml } from "../../src/lib/pdf-html";

interface PdfExportWorld {
  rootDir?: string;
  fileContents?: Map<string, string>;
  fileViewer?: ReturnType<typeof createFileViewerController>;
  pdfHtml?: string;
  markdownBody?: string;
  saveCancelled?: boolean;
  savedPdfs?: Array<{ name: string; data: Uint8Array }>;
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
