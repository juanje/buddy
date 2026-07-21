// shared/path-utils.ts — Path containment helpers.

import { isAbsolute, relative, resolve, sep } from "node:path";

/** True when `child` is `parent` or a descendant path. */
export function isWithin(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

/** Resolve `rawPath` against `abDirectory` when relative; null if outside AB home. */
export function normalizeAbPath(abDirectory: string, rawPath: string): string | null {
  const abs = isAbsolute(rawPath) ? resolve(rawPath) : resolve(abDirectory, rawPath);
  if (!isWithin(abs, abDirectory)) return null;
  return relative(abDirectory, abs).split(sep).join("/");
}
