// tests/unit/pdf-extract.test.ts — FR-INGEST-06 PDF text extraction.

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { extractPdfText } from "../../backends/pdf-extract";
import { createMinimalPdf } from "../support/minimal-pdf";

describe("extractPdfText", () => {
  it("returns text content from a valid PDF", async () => {
    const dir = mkdtempSync(join(tmpdir(), "buddy-pdf-"));
    const filePath = join(dir, "sample.pdf");
    writeFileSync(filePath, createMinimalPdf("Hello from PDF"));

    await expect(extractPdfText(filePath)).resolves.toContain("Hello from PDF");
  });

  it("returns empty string on failure", async () => {
    await expect(extractPdfText("/tmp/does-not-exist.pdf")).resolves.toBe("");
  });
});
