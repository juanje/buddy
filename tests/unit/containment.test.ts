// tests/unit/containment.test.ts — NFR-SEC-15, NFR-SEC-16.
//
// Two halves, and the second is the one that matters. The first proves
// `isContained` resolves symlinks. The second proves every enforcement point
// actually calls it — the lesson H4b cost a sprint to learn: exercising the
// primitive says nothing about whether anyone invokes it, and a containment
// check that is never reached is indistinguishable from one that is absent.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { containedRelPath, isContained, realPathOrNearest } from "../../backends/containment";
import { validateCopyDestination, validateMoveDestination, FileToolError } from "../../backends/file-tools";
import { readViewableFile, ViewableFileError } from "../../backends/viewable-file";
import { evaluateToolCall } from "../../backends/permissions";
import { isPathPersistentlyAllowed } from "../../backends/allowed-paths";

let base: string;
let root: string;
let outside: string;

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), "containment-"));
  root = join(base, "buddy");
  outside = join(base, "elsewhere");
  mkdirSync(join(root, "user"), { recursive: true });
  mkdirSync(outside, { recursive: true });
  writeFileSync(join(outside, "secret.md"), "# secret\n");
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

/** `<root>/user/<name>` pointing at a directory outside the buddy directory. */
function escapeHatch(name = "escape"): string {
  const link = join(root, "user", name);
  symlinkSync(outside, link);
  return link;
}

describe("isContained", () => {
  it("accepts an ordinary path inside the root", () => {
    expect(isContained(join(root, "user", "notes.md"), root)).toBe(true);
  });

  it("accepts a path that does not exist yet", () => {
    // Write and move destinations are the normal case, not an edge case.
    expect(isContained(join(root, "user", "new", "deep", "file.md"), root)).toBe(true);
  });

  it("rejects a plain path outside the root", () => {
    expect(isContained(join(outside, "secret.md"), root)).toBe(false);
  });

  it("rejects a symlink inside the root that points outside", () => {
    expect(isContained(join(escapeHatch(), "secret.md"), root)).toBe(false);
  });

  it("rejects a file that does not exist yet under an escaping symlink", () => {
    // The ancestor is where the redirection happens, so resolving it is the
    // whole point of realPathOrNearest.
    expect(isContained(join(escapeHatch(), "not-created-yet.md"), root)).toBe(false);
  });

  it("accepts the root reached through a symlinked alias", () => {
    // os.tmpdir() on macOS returns a path under /var, itself a symlink to
    // /private/var. Resolving only the child would call every temp file
    // outside its own root.
    const alias = join(base, "alias");
    symlinkSync(root, alias);
    expect(isContained(join(alias, "user", "notes.md"), root)).toBe(true);
    expect(isContained(join(root, "user", "notes.md"), alias)).toBe(true);
  });

  it("rejects a path that walks out with ..", () => {
    expect(isContained(join(root, "user", "..", "..", "elsewhere"), root)).toBe(false);
  });
});

describe("realPathOrNearest", () => {
  it("returns an absolute path even when nothing on it exists", () => {
    const path = join(base, "nowhere", "at", "all.md");
    expect(realPathOrNearest(path)).toContain("all.md");
  });
});

describe("containedRelPath", () => {
  it("names the file relative to the root, POSIX-style", () => {
    expect(containedRelPath(root, join(root, "user", "a", "b.md"))).toBe("user/a/b.md");
  });

  it("returns null for a path outside", () => {
    expect(containedRelPath(root, join(outside, "secret.md"))).toBeNull();
  });

  it("returns null through an escaping symlink", () => {
    expect(containedRelPath(root, join(escapeHatch(), "secret.md"))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The wiring. Each of these fails if its module still calls the lexical
// `isWithin` directly — which is exactly what they all did before NFR-SEC-16.
// ---------------------------------------------------------------------------

describe("enforcement points resolve symlinks", () => {
  it("copy_file refuses a destination that escapes through a symlink", () => {
    escapeHatch();
    expect(() => validateCopyDestination(root, "user/escape/planted.md")).toThrow(FileToolError);
  });

  it("move_file refuses a destination that escapes through a symlink", () => {
    escapeHatch();
    expect(() => validateMoveDestination(root, "user/escape/planted.md")).toThrow(FileToolError);
  });

  it("the inline viewer refuses a file reached through a symlink", () => {
    escapeHatch();
    // The href is shaped like a perfectly ordinary internal link — nothing in
    // its spelling says it leaves the buddy directory.
    expect(() => readViewableFile(root, "user/escape/secret.md")).toThrow(ViewableFileError);
  });

  it("the permission gate treats a symlinked escape as outside the workspace", () => {
    escapeHatch();
    const decision = evaluateToolCall("read", { path: "user/escape/secret.md" }, root, base);
    expect(decision.action).toBe("ask");
    if (decision.action === "ask") expect(decision.kind).toBe("outside");
  });

  it("a persistent directory approval does not extend through a symlink out of it", () => {
    // The user approved one directory. A symlink planted inside it must not
    // silently widen that approval to wherever it points.
    const approved = join(base, "approved");
    mkdirSync(approved);
    symlinkSync(outside, join(approved, "link"));

    expect(
      isPathPersistentlyAllowed(join(approved, "link", "secret.md"), [
        { path: approved, type: "directory" },
      ]),
    ).toBe(false);
  });
});
