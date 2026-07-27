// tests/unit/viewable-path.test.ts — FR-CHAT-11 / NFR-SEC-08 containment.
//
// This is the single containment authority. The July 2026 review found a
// traversal here (S1) that 162 green BDD scenarios had missed, so the
// adversarial cases are first-class, not an afterthought (NFR-TEST-01).

import { describe, expect, it } from "vitest";

import { resolveViewablePath } from "../../shared/viewable-path";

const ROOT = "/home/buddy";

describe("resolveViewablePath — allowed", () => {
  it.each([
    ["agent_brain/concepts/foo.md", "agent_brain/concepts/foo.md"],
    ["user/notes/readme.txt", "user/notes/readme.txt"],
    ["downloads/2026-07-26_article.md", "downloads/2026-07-26_article.md"],
    ["logs/2026-07-26.md", "logs/2026-07-26.md"],
    ["./agent_brain/foo.md", "agent_brain/foo.md"],
    ["agent_brain/sub/../foo.md", "agent_brain/foo.md"],
  ])("accepts %s", (href, expected) => {
    expect(resolveViewablePath(ROOT, href)).toBe(expected);
  });

  it("accepts an absolute path inside the buddy directory", () => {
    expect(resolveViewablePath(ROOT, "/home/buddy/agent_brain/foo.md")).toBe(
      "agent_brain/foo.md",
    );
  });
});

describe("resolveViewablePath — traversal is rejected, never clamped", () => {
  it.each([
    "../../secret.md",
    "user/../../../secret.md",
    "agent_brain/../../escape.md",
    "../agent_brain/foo.md",
  ])("rejects %s", (href) => {
    expect(resolveViewablePath(ROOT, href)).toBeNull();
  });
});

describe("resolveViewablePath — outside the buddy directory", () => {
  it.each([
    "/etc/hosts",
    "/home/buddy-other/agent_brain/foo.md",
    "file:///Users/someone/.ssh/id_rsa",
    "file:///home/other/user/notes.md",
  ])("rejects %s", (href) => {
    expect(resolveViewablePath(ROOT, href)).toBeNull();
  });
});

describe("resolveViewablePath — outside the four viewable directories", () => {
  it.each([
    "AGENTS.md",
    "SOUL.md",
    ".buddy/consolidation-state.json",
    ".pi/settings.json",
    ".git/config",
    "notes/readme.txt",
  ])("rejects %s", (href) => {
    expect(resolveViewablePath(ROOT, href)).toBeNull();
  });
});

describe("resolveViewablePath — non-viewable file types", () => {
  it.each([
    "downloads/guide.pdf",
    "downloads/screenshot.png",
    "downloads/payload.command",
    "downloads/script.sh",
    "downloads/installer.pkg",
    "agent_brain/noext",
  ])("rejects %s", (href) => {
    expect(resolveViewablePath(ROOT, href)).toBeNull();
  });

  it("rejects an application bundle — a .app IS a directory on macOS", () => {
    expect(resolveViewablePath(ROOT, "downloads/Evil.app")).toBeNull();
    expect(resolveViewablePath(ROOT, "downloads/Evil.app/Contents/Info.plist")).toBeNull();
  });
});

describe("resolveViewablePath — external and malformed input", () => {
  it.each([
    "https://example.com/foo.md",
    "http://example.com/foo.md",
    "",
    "   ",
    "agent_brain",
    "..",
    "/",
  ])("rejects %s", (href) => {
    expect(resolveViewablePath(ROOT, href)).toBeNull();
  });
});
