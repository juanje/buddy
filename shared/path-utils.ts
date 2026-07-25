// shared/path-utils.ts — Path containment helpers.

import { isAbsolute, relative, resolve, sep } from "node:path";

/** True when `child` is `parent` or a descendant path. */
export function isWithin(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

/** Resolve `rawPath` against `rootDir` when relative; null if outside buddy home. */
export function normalizeAbPath(rootDir: string, rawPath: string): string | null {
  const abs = isAbsolute(rawPath) ? resolve(rawPath) : resolve(rootDir, rawPath);
  if (!isWithin(abs, rootDir)) return null;
  return relative(rootDir, abs).split(sep).join("/");
}
