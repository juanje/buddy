// tests/unit/allowed-paths.test.ts — FR-PERM-06 persistent outside-path allowlist.

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  addAllowedPath,
  allowedPathsFile,
  isPathPersistentlyAllowed,
  loadAllowedPaths,
} from "../../backends/allowed-paths";
import { createPermissionGate } from "../../backends/permissions";

const HOME = "/home/u";
const AB = "/home/u/buddy";

describe("allowed-paths persistence", () => {
  it("returns an empty list when the file is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "buddy-allowed-"));
    expect(loadAllowedPaths(dir)).toEqual([]);
  });

  it("persists entries and deduplicates on add", () => {
    const dir = mkdtempSync(join(tmpdir(), "buddy-allowed-"));
    addAllowedPath(dir, { path: "/home/u/Documents/report.pdf", type: "file" });
    addAllowedPath(dir, { path: "/home/u/Documents/report.pdf", type: "file" });
    addAllowedPath(dir, { path: "/home/u/Documents", type: "directory" });

    const stored = JSON.parse(readFileSync(allowedPathsFile(dir), "utf8"));
    expect(stored.allowedPaths).toHaveLength(2);
    expect(loadAllowedPaths(dir)).toHaveLength(2);
  });

  it("matches exact files and directories recursively", () => {
    const entries = [
      { path: "/home/u/Documents/report.pdf", type: "file" as const },
      { path: "/home/u/Projects", type: "directory" as const },
    ];

    expect(isPathPersistentlyAllowed("/home/u/Documents/report.pdf", entries)).toBe(true);
    expect(isPathPersistentlyAllowed("/home/u/Documents/other.pdf", entries)).toBe(false);
    expect(isPathPersistentlyAllowed("/home/u/Projects/app/readme.md", entries)).toBe(true);
    expect(isPathPersistentlyAllowed("/home/u/Other/file.txt", entries)).toBe(false);
  });
});

describe("createPermissionGate persistentAllowedPaths", () => {
  it("allows outside reads without asking when persistently approved", async () => {
    const gate = createPermissionGate(
      AB,
      async () => {
        throw new Error("should not ask");
      },
      HOME,
      {
        persistentAllowedPaths: [{ path: "/home/u/Documents", type: "directory" }],
      },
    );

    await expect(
      gate.check("read", { path: "/home/u/Documents/notes.txt" }),
    ).resolves.toBeUndefined();
  });

  it("still asks for writes to persistently approved paths", async () => {
    let asked = false;
    const gate = createPermissionGate(
      AB,
      async () => {
        asked = true;
        return true;
      },
      HOME,
      {
        persistentAllowedPaths: [{ path: "/home/u/Documents/report.pdf", type: "file" }],
      },
    );

    await expect(
      gate.check("write", { path: "/home/u/Documents/report.pdf" }),
    ).resolves.toBeUndefined();
    expect(asked).toBe(true);
  });
});
