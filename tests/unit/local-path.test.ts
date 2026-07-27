// tests/unit/local-path.test.ts — FR-CHAT-09/11 link classification.
// Containment itself is covered by viewable-path.test.ts; this file only checks
// that the renderer's re-exports stay wired to the shared authority.

import { describe, expect, it } from "vitest";

import { isExternalHref, isViewableFile } from "../../src/lib/local-path";

describe("local-path", () => {
  it("detects external hrefs", () => {
    expect(isExternalHref("https://example.com")).toBe(true);
    expect(isExternalHref("http://example.com")).toBe(true);
    expect(isExternalHref("agent_brain/foo.md")).toBe(false);
    expect(isExternalHref("file:///tmp/x.md")).toBe(false);
  });

  it("detects viewable markdown and text files", () => {
    expect(isViewableFile("agent_brain/foo.md")).toBe(true);
    expect(isViewableFile("user/notes/readme.txt")).toBe(true);
    expect(isViewableFile("downloads/guide.pdf")).toBe(false);
  });
});
