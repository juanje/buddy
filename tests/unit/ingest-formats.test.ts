// tests/unit/ingest-formats.test.ts — FR-INGEST-04/05 format validation.

import { describe, expect, it } from "vitest";

import { isSupportedIngestFormat, isImageFormat, isPdfFormat, imageMimeType, isImageExtension, imageMimeTypeFromExt, rejectionReasonForPath } from "../../shared/ingest-formats";

describe("isSupportedIngestFormat", () => {
  it("accepts markdown and plain text", () => {
    expect(isSupportedIngestFormat("/tmp/notes.md")).toBe(true);
    expect(isSupportedIngestFormat("/tmp/readme.txt")).toBe(true);
  });

  it("rejects extensionless files", () => {
    expect(isSupportedIngestFormat("/tmp/LICENSE")).toBe(false);
    expect(isSupportedIngestFormat("/tmp/README")).toBe(false);
    expect(isSupportedIngestFormat("/tmp/Makefile")).toBe(false);
  });

  it("accepts CSV files", () => {
    expect(isSupportedIngestFormat("/tmp/data.csv")).toBe(true);
    expect(isSupportedIngestFormat("/tmp/data.CSV")).toBe(true);
  });

  it("accepts JSON files", () => {
    expect(isSupportedIngestFormat("/tmp/config.json")).toBe(true);
    expect(isSupportedIngestFormat("/tmp/config.JSON")).toBe(true);
  });

  it("accepts YAML files", () => {
    expect(isSupportedIngestFormat("/tmp/settings.yaml")).toBe(true);
    expect(isSupportedIngestFormat("/tmp/settings.yml")).toBe(true);
    expect(isSupportedIngestFormat("/tmp/settings.YML")).toBe(true);
  });

  it("accepts log files", () => {
    expect(isSupportedIngestFormat("/tmp/app.log")).toBe(true);
    expect(isSupportedIngestFormat("/tmp/app.LOG")).toBe(true);
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

  it("rejects spreadsheet formats", () => {
    expect(isSupportedIngestFormat("/tmp/data.xlsx")).toBe(false);
    expect(isSupportedIngestFormat("/tmp/data.xls")).toBe(false);
    expect(isSupportedIngestFormat("/tmp/data.ods")).toBe(false);
  });

  it("rejects document formats", () => {
    expect(isSupportedIngestFormat("/tmp/doc.docx")).toBe(false);
    expect(isSupportedIngestFormat("/tmp/slides.pptx")).toBe(false);
    expect(isSupportedIngestFormat("/tmp/book.epub")).toBe(false);
  });
});

describe("rejectionReasonForPath", () => {
  it("returns 'spreadsheet' for spreadsheet extensions", () => {
    expect(rejectionReasonForPath("/tmp/data.xlsx")).toBe("spreadsheet");
    expect(rejectionReasonForPath("/tmp/data.xls")).toBe("spreadsheet");
    expect(rejectionReasonForPath("/tmp/data.ods")).toBe("spreadsheet");
    expect(rejectionReasonForPath("/tmp/data.XLSX")).toBe("spreadsheet");
  });

  it("returns 'document' for document extensions", () => {
    expect(rejectionReasonForPath("/tmp/doc.docx")).toBe("document");
    expect(rejectionReasonForPath("/tmp/slides.pptx")).toBe("document");
    expect(rejectionReasonForPath("/tmp/book.epub")).toBe("document");
  });

  it("returns 'unknown' for other unsupported extensions", () => {
    expect(rejectionReasonForPath("/tmp/movie.mp4")).toBe("unknown");
    expect(rejectionReasonForPath("/tmp/archive.zip")).toBe("unknown");
    expect(rejectionReasonForPath("/tmp/binary.exe")).toBe("unknown");
  });

  it("returns 'unknown' for extensionless files", () => {
    expect(rejectionReasonForPath("/tmp/LICENSE")).toBe("unknown");
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

describe("isImageExtension", () => {
  it("identifies image extensions with leading dot", () => {
    expect(isImageExtension(".png")).toBe(true);
    expect(isImageExtension(".PNG")).toBe(true);
    expect(isImageExtension(".md")).toBe(false);
  });
});

describe("imageMimeTypeFromExt", () => {
  it("returns correct MIME types from extension", () => {
    expect(imageMimeTypeFromExt(".png")).toBe("image/png");
    expect(imageMimeTypeFromExt(".jpg")).toBe("image/jpeg");
    expect(imageMimeTypeFromExt(".unknown")).toBe("application/octet-stream");
  });
});
