// tests/unit/attachment-classifier.test.ts — classifyAttachments, extracted
// from chat-controller.ts's `addAttachments` (FR-INGEST-04).

import { describe, expect, it } from "vitest";

import { classifyAttachments } from "../../src/lib/attachment-classifier";

describe("classifyAttachments", () => {
  it("accepts a supported path with no existing attachments", () => {
    const { accepted, rejected } = classifyAttachments(["/tmp/notes.md"], []);
    expect(accepted).toEqual([{ path: "/tmp/notes.md", name: "notes.md" }]);
    expect(rejected).toEqual([]);
  });

  it("rejects an unsupported format with reason", () => {
    const { accepted, rejected } = classifyAttachments(["/tmp/movie.mp4"], []);
    expect(accepted).toEqual([]);
    expect(rejected).toEqual([{ name: "movie.mp4", reason: "unknown" }]);
  });

  it("rejects a spreadsheet with reason 'spreadsheet'", () => {
    const { rejected } = classifyAttachments(["/tmp/data.xlsx"], []);
    expect(rejected).toEqual([{ name: "data.xlsx", reason: "spreadsheet" }]);
  });

  it("rejects a document with reason 'document'", () => {
    const { rejected } = classifyAttachments(["/tmp/report.docx"], []);
    expect(rejected).toEqual([{ name: "report.docx", reason: "document" }]);
  });

  it("rejects extensionless files", () => {
    const { accepted, rejected } = classifyAttachments(["/tmp/LICENSE"], []);
    expect(accepted).toEqual([]);
    expect(rejected).toEqual([{ name: "LICENSE", reason: "unknown" }]);
  });

  it("drops a path already pending, silently — neither list gets it", () => {
    const existing = [{ path: "/tmp/notes.md", name: "notes.md" }];
    const { accepted, rejected } = classifyAttachments(["/tmp/notes.md"], existing);
    expect(accepted).toEqual([]);
    expect(rejected).toEqual([]);
  });

  it("handles a mix of accepted, rejected and duplicate paths in one call", () => {
    const existing = [{ path: "/tmp/already.md", name: "already.md" }];
    const { accepted, rejected } = classifyAttachments(
      ["/tmp/new.md", "/tmp/already.md", "/tmp/bad.exe"],
      existing,
    );
    expect(accepted).toEqual([{ path: "/tmp/new.md", name: "new.md" }]);
    expect(rejected).toEqual([{ name: "bad.exe", reason: "unknown" }]);
  });

  it("returns two empty lists for no input", () => {
    expect(classifyAttachments([], [])).toEqual({ accepted: [], rejected: [] });
  });

  it("adds the same new path twice if it appears twice in one call", () => {
    const { accepted } = classifyAttachments(["/tmp/new.md", "/tmp/new.md"], []);
    expect(accepted).toEqual([
      { path: "/tmp/new.md", name: "new.md" },
      { path: "/tmp/new.md", name: "new.md" },
    ]);
  });

  it("accepts new text formats: csv, json, yaml, yml, log", () => {
    for (const ext of [".csv", ".json", ".yaml", ".yml", ".log"]) {
      const { accepted, rejected } = classifyAttachments([`/tmp/file${ext}`], []);
      expect(accepted.length, `${ext} should be accepted`).toBe(1);
      expect(rejected.length, `${ext} should not be rejected`).toBe(0);
    }
  });
});
