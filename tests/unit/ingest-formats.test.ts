// tests/unit/ingest-formats.test.ts — FR-INGEST-04/05 format validation.

import { describe, expect, it } from "vitest";

import { isSupportedIngestFormat, isImageFormat, isPdfFormat, imageMimeType } from "../../shared/ingest-formats";

describe("isSupportedIngestFormat", () => {
  it("accepts markdown and plain text", () => {
    expect(isSupportedIngestFormat("/tmp/notes.md")).toBe(true);
    expect(isSupportedIngestFormat("/tmp/readme.txt")).toBe(true);
    expect(isSupportedIngestFormat("/tmp/LICENSE")).toBe(true);
  });

  it("accepts image formats", () => {
    expect(isSupportedIngestFormat("/tmp/photo.png")).toBe(true);
    expect(isSupportedIngestFormat("/tmp/image.jpg")).toBe(true);
    expect(isSupportedIngestFormat("/tmp/pic.jpeg")).toBe(true);
    expect(isSupportedIngestFormat("/tmp/anim.gif")).toBe(true);
    expect(isSupportedIngestFormat("/tmp/modern.webp")).toBe(true);
  });

  it("accepts PDF format", () => {
    expect(isSupportedIngestFormat("/tmp/report.pdf")).toBe(true);
  });

  it("rejects other binary document formats", () => {
    expect(isSupportedIngestFormat("/tmp/doc.docx")).toBe(false);
  });
});

describe("isPdfFormat", () => {
  it("identifies PDF extension", () => {
    expect(isPdfFormat("/tmp/report.pdf")).toBe(true);
    expect(isPdfFormat("/tmp/report.PDF")).toBe(true);
    expect(isPdfFormat("/tmp/notes.md")).toBe(false);
  });
});

describe("isImageFormat", () => {
  it("identifies image extensions", () => {
    expect(isImageFormat("/tmp/photo.png")).toBe(true);
    expect(isImageFormat("/tmp/photo.PNG")).toBe(true);
    expect(isImageFormat("/tmp/notes.md")).toBe(false);
    expect(isImageFormat("/tmp/LICENSE")).toBe(false);
  });
});

describe("imageMimeType", () => {
  it("returns correct MIME types", () => {
    expect(imageMimeType("photo.png")).toBe("image/png");
    expect(imageMimeType("photo.jpg")).toBe("image/jpeg");
    expect(imageMimeType("photo.jpeg")).toBe("image/jpeg");
    expect(imageMimeType("anim.gif")).toBe("image/gif");
    expect(imageMimeType("modern.webp")).toBe("image/webp");
  });
});
