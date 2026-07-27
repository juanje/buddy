// tests/unit/viewable-file.test.ts — NFR-SEC-08/09 worker-side enforcement.
// The frontend has no filesystem capability; this is the only reader.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readViewableFile, ViewableFileError } from "../../backends/viewable-file";

let root: string;
let outside: string;

beforeEach(() => {
  const base = mkdtempSync(join(tmpdir(), "buddy-viewable-"));
  root = join(base, "buddy");
  outside = base;
  mkdirSync(join(root, "agent_brain", "concepts"), { recursive: true });
  mkdirSync(join(root, "downloads"), { recursive: true });
  writeFileSync(join(root, "agent_brain", "concepts", "foo.md"), "# Title\n", "utf8");
  writeFileSync(join(root, "downloads", "guide.pdf"), "%PDF-1.4", "utf8");
  writeFileSync(join(root, "AGENTS.md"), "rules", "utf8");
  writeFileSync(join(outside, "secret.md"), "SECRET", "utf8");
});

afterEach(() => {
  rmSync(outside, { recursive: true, force: true });
});

describe("readViewableFile", () => {
  it("reads a viewable file inside an allowed directory", () => {
    expect(readViewableFile(root, "agent_brain/concepts/foo.md")).toBe("# Title\n");
  });

  it("refuses to read through a traversal, even though the file exists", () => {
    expect(() => readViewableFile(root, "../secret.md")).toThrow(ViewableFileError);
    expect(() => readViewableFile(root, "agent_brain/../../secret.md")).toThrow(
      ViewableFileError,
    );
  });

  it("refuses a non-viewable type inside an allowed directory", () => {
    expect(() => readViewableFile(root, "downloads/guide.pdf")).toThrow(ViewableFileError);
  });

  it("refuses a viewable file outside the allowed directories", () => {
    expect(() => readViewableFile(root, "AGENTS.md")).toThrow(ViewableFileError);
  });

  it("reports a missing file distinctly from a refused one", () => {
    expect(() => readViewableFile(root, "agent_brain/missing.md")).toThrow(/not found/i);
  });

  it("refuses a directory", () => {
    expect(() => readViewableFile(root, "agent_brain/concepts")).toThrow(ViewableFileError);
  });
});
