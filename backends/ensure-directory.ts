// backends/ensure-directory.ts — Create or adopt a directory without Bun/Windows
// mkdir traps (NFR-PORT-11).
//
// Node's `mkdirSync(path, { recursive: true })` is a no-op when `path` already
// exists as a directory. Bun on Windows throws `EEXIST` for the same call when
// Explorer has set the directory ReadOnly attribute (common on empty folders
// the user created by hand — oven-sh/bun#34413). Setup must adopt an empty
// folder, not fail with a raw syscall error after OAuth.

import { execFileSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import { dirname } from "node:path";

import { windowsHideSpawnOption } from "./windows-process";

export type AttribRunner = (args: string[]) => void;

function defaultAttribRunner(args: string[]): void {
  // NFR-PORT-09: attrib is a console-subsystem tool — hide the flash.
  execFileSync("attrib", args, {
    stdio: "ignore",
    ...windowsHideSpawnOption(),
  });
}

/**
 * Clear Explorer's directory ReadOnly flag on Windows (best effort).
 *
 * The flag does not block creating files inside the folder, but Bun's
 * recursive mkdir treats it as a hard conflict. No-op on POSIX and when
 * `attrib` is unavailable.
 */
export function clearWindowsDirectoryReadOnly(
  dir: string,
  options?: { runner?: AttribRunner; platform?: NodeJS.Platform },
): void {
  const platform = options?.platform ?? process.platform;
  if (platform !== "win32") return;
  const runner = options?.runner ?? defaultAttribRunner;
  try {
    runner(["-R", dir]);
  } catch {
    // Best effort — setup can still proceed if mkdir is guarded below.
  }
}

/**
 * Ensure `dir` exists as a directory. Adopts an existing directory; creates
 * parents as needed. Never throws EEXIST for an existing directory (Node or Bun).
 *
 * Throws a plain-language error when the path exists and is not a directory.
 */
export function ensureDirectory(dir: string): void {
  try {
    const st = statSync(dir);
    if (!st.isDirectory()) {
      throw new Error("That path exists and is not a folder.");
    }
    clearWindowsDirectoryReadOnly(dir);
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") throw error;
  }

  const parent = dirname(dir);
  if (parent && parent !== dir) {
    ensureDirectory(parent);
  }

  try {
    // Non-recursive: parents are handled above. Avoid Bun's recursive+ReadOnly
    // EEXIST path entirely.
    mkdirSync(dir);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === "EEXIST") {
      const st = statSync(dir);
      if (st.isDirectory()) {
        clearWindowsDirectoryReadOnly(dir);
        return;
      }
      throw new Error("That path exists and is not a folder.");
    }
    throw error;
  }
}
