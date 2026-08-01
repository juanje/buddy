// tests/unit/attachment-classifier.test.ts — classifyAttachments, extracted
// from chat-controller.ts's `addAttachments` (FR-INGEST-04).
//
// Previously exercised only by driving the whole controller through BDD. Here
// it is a pure function of two arrays, so every case is a one-line assertion.

import { describe, expect, it } from "vitest";

import { classifyAttachments } from "../../src/lib/attachment-classifier";

describe("classifyAttachments", () => {
  it("accepts a supported path with no existing attachments", () => {
    const { accepted, rejected } = classifyAttachments(["/tmp/notes.md"], []);
    expect(accepted).toEqual([{ path: "/tmp/notes.md", name: "notes.md" }]);
    expect(rejected).toEqual([]);
  });

  it("rejects an unsupported format by file name", () => {
    const { accepted, rejected } = classifyAttachments(["/tmp/movie.mp4"], []);
    expect(accepted).toEqual([]);
    expect(rejected).toEqual(["movie.mp4"]);
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
    expect(rejected).toEqual(["bad.exe"]);
  });

  it("returns two empty lists for no input", () => {
    expect(classifyAttachments([], [])).toEqual({ accepted: [], rejected: [] });
  });

  // Documents the inherited quirk rather than hiding it: a duplicate within
  // the same call is only checked against `existing`, not against what this
  // same call already accepted.
  it("adds the same new path twice if it appears twice in one call", () => {
    const { accepted } = classifyAttachments(["/tmp/new.md", "/tmp/new.md"], []);
    expect(accepted).toEqual([
      { path: "/tmp/new.md", name: "new.md" },
      { path: "/tmp/new.md", name: "new.md" },
    ]);
  });
});
