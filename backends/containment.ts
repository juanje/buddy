// backends/containment.ts — The worker's single containment authority
// (NFR-SEC-15, NFR-SEC-16).
//
// Before this module, "is this path inside the buddy directory?" was answered in
// four places: `isWithin` (lexical), `toBuddyRelPath` (lexical),
// `resolveViewablePath` (segment-based, browser-safe) and a `startsWith
// ("agent_brain/")` string test in consolidation-relocate.ts. The last one was
// wrong — `agent_brain/../.pi/settings.json` passes it — which is the argument
// for this module rather than a matter of taste: a containment rule written four
// times is a containment rule that disagrees with itself.
//
// The division of labour is now explicit:
//
//   - `shared/viewable-path.ts` decides the *shape* of an agent-authored link.
//     It is browser-safe, so it cannot touch the filesystem, and its verdict is
//     presentational: it says what may be offered, never what may be read.
//   - This module decides *filesystem truth*. Every worker-side enforcement
//     point calls `isContained`, and nothing else.
//
// Symlinks are resolved here and only here (NFR-SEC-15). A lexical comparison
// answers a question about spelling; the filesystem question is whether the
// bytes read live under the buddy directory, and `user/notes -> /etc` makes
// those two answers differ.

import { realpathSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

import { isWithin } from "../shared/path-utils";

/**
 * The real path of `path`, resolving every symlink along the way.
 *
 * A path that does not exist yet still has to be judged — write and move
 * destinations are the normal case. For those, the nearest existing ancestor is
 * resolved and the remaining segments are appended: the ancestor is where a
 * symlink could redirect the write, so resolving it is what matters.
 */
export function realPathOrNearest(path: string): string {
  const absolute = resolve(path);
  let current = absolute;
  const pending: string[] = [];

  for (;;) {
    try {
      const real = realpathSync(current);
      return pending.length === 0 ? real : join(real, ...pending);
    } catch {
      const parent = dirname(current);
      if (parent === current) return absolute; // reached the root; nothing resolvable
      pending.unshift(basename(current));
      current = parent;
    }
  }
}

/**
 * True when `childPath` is `parentDir` or lives under it, after symlinks on both
 * sides are resolved (NFR-SEC-15).
 *
 * Resolving *both* sides is deliberate. On macOS `os.tmpdir()` hands back a path
 * under `/var`, which is itself a symlink to `/private/var`; resolving only the
 * child would report every file in a temp directory as outside its own root.
 */
export function isContained(childPath: string, parentDir: string): boolean {
  return isWithin(realPathOrNearest(childPath), realPathOrNearest(parentDir));
}

/**
 * `absPath` as a POSIX path relative to `rootDir`, or null when it is outside.
 *
 * The returned path is derived from the resolved locations, so it names where
 * the file actually is — which is what git commands and stored state need.
 */
export function containedRelPath(rootDir: string, absPath: string): string | null {
  const realRoot = realPathOrNearest(rootDir);
  const realChild = realPathOrNearest(absPath);
  if (!isWithin(realChild, realRoot)) return null;
  return relative(realRoot, realChild).split(sep).join("/");
}
