// tests/unit/local-path.test.ts — FR-CHAT-09 path resolution.

import { describe, expect, it } from "vitest";

import { isExternalHref, isViewableFile, resolveLocalPathForOpen } from "../../src/lib/local-path";

describe("local-path", () => {
  it("detects external hrefs", () => {
    expect(isExternalHref("https://example.com")).toBe(true);
    expect(isExternalHref("http://example.com")).toBe(true);
    expect(isExternalHref("agent_brain/foo.md")).toBe(false);
    expect(isExternalHref("file:///tmp/x.md")).toBe(false);
  });

  it("resolves relative paths under rootDir", () => {
    expect(resolveLocalPathForOpen("/home/buddy", "agent_brain/foo.md")).toBe(
      "/home/buddy/agent_brain/foo.md",
    );
  });

  it("rejects paths outside rootDir", () => {
    expect(resolveLocalPathForOpen("/home/buddy", "/etc/passwd")).toBeNull();
  });

  it("detects viewable markdown and text files", () => {
    expect(isViewableFile("/home/buddy/agent_brain/foo.md")).toBe(true);
    expect(isViewableFile("/home/buddy/notes/readme.txt")).toBe(true);
    expect(isViewableFile("/home/buddy/docs/guide.pdf")).toBe(false);
  });
});
