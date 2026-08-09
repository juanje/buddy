// tests/unit/config-permissions.test.ts — NFR-SEC-17.
//
// auth.json was the only file under ~/.buddy/ with a mode of its own. The
// directory itself, and everything else in it, took the umask default — 0755
// and 0644 on a normal install. allowed-paths.json is the one that stings: it
// is a list of every directory outside the workspace the user has granted the
// agent access to, which is a map of where their private files are kept.
//
// Modes are asserted at creation. "Written, then chmod-ed" leaves a window in
// which the file is readable by everyone, and a window is all an attacker with
// a local account needs.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";

import { writeStateFile } from "../../backends/state-file";
import { addAllowedPath, allowedPathsFile } from "../../backends/allowed-paths";
import { ensureConfigDirMode } from "../../backends/global-config";
import { AUTH_FILE_MODE, CONFIG_DIR_MODE, STATE_FILE_MODE } from "../../shared/defaults";

let base: string;

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), "config-perms-"));
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

const modeOf = (path: string) => statSync(path).mode & 0o777;

/** NFR-SEC-17: POSIX mode bits on Unix; ACL (no BUILTIN\\Users) on Windows. */
function assertRestricted(path: string, posixMode: number): void {
  if (process.platform === "win32") {
    const listing = execFileSync("icacls", [path], { encoding: "utf8" });
    expect(listing, path).toMatch(/\(F\)/);
    expect(listing.toLowerCase(), path).not.toMatch(/builtin\\users/);
    expect(listing.toLowerCase(), path).toContain(userInfo().username.toLowerCase());
  } else {
    expect(modeOf(path), path).toBe(posixMode);
  }
}

describe("state files are created restrictively", () => {
  it("writes a state file 0600 by default", () => {
    const path = join(base, "conf", "config.json");
    writeStateFile(path, { rootDir: "/somewhere" });
    assertRestricted(path, STATE_FILE_MODE);
  });

  it("creates the directory it needs at 0700", () => {
    writeStateFile(join(base, "conf", "config.json"), {});
    assertRestricted(join(base, "conf"), CONFIG_DIR_MODE);
  });

  it("still honours an explicit mode", () => {
    const path = join(base, "conf", "auth.json");
    writeStateFile(path, {}, { mode: AUTH_FILE_MODE });
    assertRestricted(path, AUTH_FILE_MODE);
  });

  it("keeps the mode across the rewrite of an existing file", () => {
    // The atomic write creates a fresh temp file and renames it over the old
    // one, so the mode has to be reapplied every time rather than inherited.
    const path = join(base, "conf", "usage.json");
    writeStateFile(path, { a: 1 });
    writeStateFile(path, { a: 2 });
    assertRestricted(path, STATE_FILE_MODE);
  });

  it("protects allowed-paths.json, which names the user's private directories", () => {
    const dir = join(base, "buddy-config");
    addAllowedPath(dir, { path: join(base, "Documents"), type: "directory" });
    assertRestricted(allowedPathsFile(dir), STATE_FILE_MODE);
    assertRestricted(dir, CONFIG_DIR_MODE);
  });
});

describe("ensureConfigDirMode", () => {
  it("creates the config directory at 0700", () => {
    const dir = join(base, "fresh");
    ensureConfigDirMode(dir);
    assertRestricted(dir, CONFIG_DIR_MODE);
  });

  it("narrows a directory that already exists too permissively", () => {
    // Every install that predates this requirement is in exactly this state,
    // and nothing else would ever rewrite the mode.
    const dir = join(base, "legacy");
    mkdirSync(dir);
    if (process.platform !== "win32") chmodSync(dir, 0o755);

    ensureConfigDirMode(dir);

    assertRestricted(dir, CONFIG_DIR_MODE);
  });

  it("does not throw when the directory cannot be touched", () => {
    // A config directory on a filesystem that ignores chmod is not a reason to
    // refuse to start; the files inside are 0600 either way.
    expect(() => ensureConfigDirMode(join(base, "a-file-not-a-dir", "x", "y"))).not.toThrow();
  });
});
