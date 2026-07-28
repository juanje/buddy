// tests/unit/allowed-paths.test.ts — FR-PERM-06 persistent outside-path allowlist.

import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import {
  addAllowedPath,
  allowedPathsFile,
  isPathPersistentlyAllowed,
  loadAllowedPaths,
  type AllowedEntry,
} from "../../backends/allowed-paths";
import { createPermissionGate } from "../../backends/permissions";

// A real directory: containment resolves symlinks now (NFR-SEC-15), so these
// paths are handed to the filesystem rather than only compared as strings.
const HOME = mkdtempSync(join(tmpdir(), "allowed-paths-home-"));
const AB = `${HOME}/buddy`;

mkdirSync(join(HOME, "Documents"), { recursive: true });
mkdirSync(join(HOME, "Projects"), { recursive: true });
mkdirSync(AB, { recursive: true });

afterAll(() => {
  rmSync(HOME, { recursive: true, force: true });
});

describe("allowed-paths persistence", () => {
  it("returns an empty list when the file is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "buddy-allowed-"));
    expect(loadAllowedPaths(dir)).toEqual([]);
  });

  it("persists entries and deduplicates on add", () => {
    const dir = mkdtempSync(join(tmpdir(), "buddy-allowed-"));
    addAllowedPath(dir, { path: `${HOME}/Documents/report.pdf`, type: "file" });
    addAllowedPath(dir, { path: `${HOME}/Documents/report.pdf`, type: "file" });
    addAllowedPath(dir, { path: `${HOME}/Documents`, type: "directory" });

    const stored = JSON.parse(readFileSync(allowedPathsFile(dir), "utf8"));
    expect(stored.allowedPaths).toHaveLength(2);
    expect(loadAllowedPaths(dir)).toHaveLength(2);
  });

  it("matches exact files and directories recursively", () => {
    const entries = [
      { path: `${HOME}/Documents/report.pdf`, type: "file" as const },
      { path: `${HOME}/Projects`, type: "directory" as const },
    ];

    expect(isPathPersistentlyAllowed(`${HOME}/Documents/report.pdf`, entries)).toBe(true);
    expect(isPathPersistentlyAllowed(`${HOME}/Documents/other.pdf`, entries)).toBe(false);
    expect(isPathPersistentlyAllowed(`${HOME}/Projects/app/readme.md`, entries)).toBe(true);
    expect(isPathPersistentlyAllowed(`${HOME}/Other/file.txt`, entries)).toBe(false);
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
        getPersistentAllowedPaths: () => [{ path: `${HOME}/Documents`, type: "directory" }],
      },
    );

    await expect(
      gate.check("read", { path: `${HOME}/Documents/notes.txt` }),
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
        getPersistentAllowedPaths: () => [{ path: `${HOME}/Documents/report.pdf`, type: "file" }],
      },
    );

    await expect(
      gate.check("write", { path: `${HOME}/Documents/report.pdf` }),
    ).resolves.toBeUndefined();
    expect(asked).toBe(true);
  });

  it("picks up newly-added paths without session restart", async () => {
    const entries: AllowedEntry[] = [];
    let askCount = 0;
    const gate = createPermissionGate(
      AB,
      async () => {
        askCount++;
        return true;
      },
      HOME,
      {
        getPersistentAllowedPaths: () => entries,
      },
    );

    await gate.check("read", { path: `${HOME}/Projects/foo.md` });
    expect(askCount).toBe(1);

    entries.push({ path: `${HOME}/Projects`, type: "directory" });

    await gate.check("read", { path: `${HOME}/Projects/foo.md` });
    expect(askCount).toBe(1);
  });
});
