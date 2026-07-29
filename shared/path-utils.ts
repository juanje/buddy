// shared/path-utils.ts — Path containment helpers.

/** @backend-only — imports node:path; not browser-safe. */

import { isAbsolute, join, relative, resolve, sep } from "node:path";

/** Expand `~` and `~/…` using the given home directory. */
export function expandHome(path: string, home: string): string {
  return path === "~" ? home : path.startsWith("~/") ? join(home, path.slice(2)) : path;
}

/** True when `child` is `parent` or a descendant path. */
export function isWithin(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

/** Resolve `rawPath` against `rootDir` when relative; null if outside buddy home. */
export function toBuddyRelPath(rootDir: string, rawPath: string): string | null {
  const abs = isAbsolute(rawPath) ? resolve(rawPath) : resolve(rootDir, rawPath);
  if (!isWithin(abs, rootDir)) return null;
  return relative(rootDir, abs).split(sep).join("/");
}
