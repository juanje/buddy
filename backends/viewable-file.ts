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
import { isWithin } from "../shared/path-utils";

export class ViewableFileError extends Error {}

/**
 * Read a file the agent linked to, or throw. `rawHref` is untrusted: it comes
 * from LLM output, which is influenced by fetched web content.
 */
export function readViewableFile(rootDir: string, rawHref: string): string {
  const relPath = resolveViewablePath(rootDir, rawHref);
  if (!relPath) {
    throw new ViewableFileError("This file cannot be opened inside Buddy.");
  }

  const absPath = resolve(rootDir, relPath);
  // Belt-and-braces: resolveViewablePath already guarantees containment, but
  // the read itself must never be reachable outside the buddy directory.
  if (!isWithin(absPath, rootDir)) {
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

  return readFileSync(absPath, "utf8");
}
