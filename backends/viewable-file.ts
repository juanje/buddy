// backends/viewable-file.ts — Worker-side enforcement for the inline file
// viewer (FR-CHAT-11, NFR-SEC-08, NFR-SEC-09).
//
// The frontend holds no filesystem capability: it sends the raw href the agent
// wrote, and this module decides whether anything is read at all. The
// containment rule itself lives in shared/viewable-path.ts so there is exactly
// one implementation.

import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { resolveViewablePath } from "../shared/viewable-path";
import { isContained } from "./containment";

export class ViewableFileError extends Error {}

/**
 * Decide whether a file may be opened inside Buddy, and where it is.
 *
 * Split out of `readViewableFile` for FR-CHAT-17: `show_file` asks the same
 * question without wanting the bytes. Two callers asking it two ways is how
 * this project once ended up with four answers to "is this path inside the
 * buddy directory?", one of them wrong.
 */
export function resolveViewableFile(
  rootDir: string,
  rawHref: string,
): { relPath: string; absPath: string } {
  const relPath = resolveViewablePath(rootDir, rawHref);
  if (!relPath) {
    throw new ViewableFileError("This file cannot be opened inside Buddy.");
  }

  const absPath = resolve(rootDir, relPath);
  // Not belt-and-braces: `resolveViewablePath` is browser-safe and reasons about
  // the *spelling* of the link, which is all the frontend can do. Whether the
  // bytes live inside the buddy directory is a filesystem question, and this is
  // where it is asked (NFR-SEC-15, NFR-SEC-16). `user/notes -> /etc` produces a
  // link whose spelling is beyond reproach.
  if (!isContained(absPath, rootDir)) {
    throw new ViewableFileError("This file cannot be opened inside Buddy.");
  }

  let stat;
  try {
    stat = statSync(absPath);
  } catch {
    throw new ViewableFileError(`File not found: ${relPath}`);
  }
  if (!stat.isFile()) {
    throw new ViewableFileError(`Not a file: ${relPath}`);
  }

  return { relPath, absPath };
}

/**
 * Read a file the agent linked to, or throw. `rawHref` is untrusted: it comes
 * from LLM output, which is influenced by fetched web content.
 */
export function readViewableFile(rootDir: string, rawHref: string): string {
  const { absPath } = resolveViewableFile(rootDir, rawHref);
  return readFileSync(absPath, "utf8");
}
