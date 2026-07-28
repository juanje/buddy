// tests/unit/fetch-url.test.ts — FR-NET-01 fetch_url pure logic.

import { describe, expect, it } from "vitest";

import {
  buildDownloadFilename,
  formatFetchHttpError,
  formatFetchSizeError,
  formatFetchTimeoutError,
  htmlToMarkdown,
  resolveFetchContentKind,
  slugifyDownloadName,
} from "../../backends/fetch-url";

describe("resolveFetchContentKind", () => {
  it("detects html from content-type", () => {
    expect(resolveFetchContentKind("text/html; charset=utf-8", "https://x.com/a")).toBe("html");
  });

  it("detects pdf from content-type", () => {
    expect(resolveFetchContentKind("application/pdf", "https://x.com/a")).toBe("pdf");
  });

  it("detects image from content-type", () => {
    expect(resolveFetchContentKind("image/png", "https://x.com/a")).toBe("image");
  });

  it("falls back to URL extension when content-type is missing", () => {
    expect(resolveFetchContentKind(null, "https://x.com/report.pdf")).toBe("pdf");
    expect(resolveFetchContentKind(null, "https://x.com/photo.jpg")).toBe("image");
  });

  it("defaults to html for unknown types", () => {
    expect(resolveFetchContentKind("application/octet-stream", "https://x.com/page")).toBe("html");
  });
});

describe("slugifyDownloadName", () => {
  it("slugifies titles", () => {
    expect(slugifyDownloadName("Article Title Here")).toBe("article-title-here");
  });

  it("falls back to url pathname", () => {
    expect(slugifyDownloadName("", "https://example.com/my-report.pdf")).toBe("my-report");
  });

  it("uses generic slug when empty", () => {
    expect(slugifyDownloadName("", "https://example.com/")).toBe("download");
  });
});

describe("buildDownloadFilename", () => {
  it("builds date-prefixed filename", () => {
    expect(buildDownloadFilename("2026-07-25", "article-title", "md")).toBe(
      "2026-07-25_article-title.md",
    );
  });
});

describe("error formatting", () => {
  it("formats HTTP errors", () => {
    expect(formatFetchHttpError(404, "https://example.com/missing")).toContain("HTTP 404");
  });

  it("formats size errors", () => {
    expect(formatFetchSizeError(10)).toContain("exceeds");
  });

  it("formats timeout errors", () => {
    expect(formatFetchTimeoutError("https://example.com/slow")).toContain("timed out");
  });
});

describe("htmlToMarkdown", () => {
  it("extracts article content as markdown", () => {
    const html = `<!DOCTYPE html><html><head><title>Article Title</title></head><body><article><p>Article body text</p></article></body></html>`;
    const { markdown } = htmlToMarkdown(html);
    expect(markdown).toContain("Article body text");
    expect(markdown.toLowerCase()).not.toContain("<script");
  });

  it("returns the document title, so the caller need not parse the page again", () => {
    const html = `<!DOCTYPE html><html><head><title>Article Title</title></head><body><article><p>Body</p></article></body></html>`;
    expect(htmlToMarkdown(html).documentTitle).toBe("Article Title");
  });

  it("returns an empty title rather than undefined for a page without one", () => {
    // slugifyDownloadName is handed this value directly now.
    expect(htmlToMarkdown("<html><body><p>x</p></body></html>").documentTitle).toBe("");
  });
});
