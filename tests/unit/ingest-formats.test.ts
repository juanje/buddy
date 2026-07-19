// tests/unit/ingest-formats.test.ts — FR-INGEST-04 format validation.

import { describe, expect, it } from "vitest";

import { isSupportedIngestFormat } from "../../shared/ingest-formats";

describe("isSupportedIngestFormat", () => {
  it("accepts markdown and plain text", () => {
    expect(isSupportedIngestFormat("/tmp/notes.md")).toBe(true);
    expect(isSupportedIngestFormat("/tmp/readme.txt")).toBe(true);
    expect(isSupportedIngestFormat("/tmp/LICENSE")).toBe(true);
  });

  it("rejects binary document formats", () => {
    expect(isSupportedIngestFormat("/tmp/report.pdf")).toBe(false);
    expect(isSupportedIngestFormat("/tmp/doc.docx")).toBe(false);
  });
});
