// shared/viewable-path.ts — Single containment authority for agent-authored
// local links (FR-CHAT-11, NFR-SEC-08).
// Browser-safe: no Node.js imports. Segment normalization is implemented here
// rather than delegated to node:path so the frontend and the worker apply the
// exact same rule — a second implementation is how the July 2026 traversal
// (S1) happened in the first place.
//
// Enforcement lives in the worker (backends/viewable-file.ts). The frontend may
// call this to decide whether to render a link as clickable, but that decision
// is presentational: nothing is read until the worker validates again.

import { VIEWABLE_DIRS, VIEWABLE_EXTENSIONS } from "./defaults";

/** True when the href should open in the system browser, not inside Buddy. */
export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/** True when the extension is one Buddy can render inside the app. */
export function isViewableFile(path: string): boolean {
  const lower = path.toLowerCase();
  return VIEWABLE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Collapse `.` and `..` segments. Returns null when the path escapes its base —
 * `..` popping past the root is a rejection, never a clamp.
 */
function normalizeSegments(segments: string[]): string[] | null {
  const out: string[] = [];
  for (const segment of segments) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (out.length === 0) return null;
      out.pop();
      continue;
    }
    out.push(segment);
  }
  return out;
}

function splitPath(path: string): string[] {
  return path.replace(/\\/g, "/").split("/");
}

function isAbsolute(path: string): boolean {
  return path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path);
}

/** Directory part of a path relative to the buddy directory. */
function relativeDirOf(relPath: string): string[] {
  const segments = splitPath(relPath).filter((s) => s !== "" && s !== ".");
  return segments.slice(0, -1);
}

/**
 * Resolve an agent-authored link to a path relative to the buddy directory,
 * or null when it must not be opened.
 *
 * Rejects, in order: external URLs, paths escaping the buddy directory (via
 * `..`, an absolute path, or a `file://` URL), paths outside the four
 * user-facing directories, and file types Buddy cannot render inline.
 *
 * `fromRelPath` is the document the link was written in. Links inside a
 * document are relative to it, not to the buddy root: a page at
 * `user/wiki/topic/page.md` links to `sibling.md` and `../other/page.md`
 * (FR-CHAT-12). Resolving those against the root would reject all of them.
 * Containment is unaffected — segments are collapsed after joining, so `..`
 * that walks past the root is still a rejection, not a clamp.
 */
export function resolveViewablePath(
  rootDir: string,
  rawHref: string,
  fromRelPath?: string,
): string | null {
  const href = rawHref.trim();
  if (!href || isExternalHref(href)) return null;

  const stripped = href.replace(/^file:\/\//i, "");
  let relSegments: string[] | null;

  if (isAbsolute(stripped)) {
    const rootSegments = normalizeSegments(splitPath(rootDir));
    const pathSegments = normalizeSegments(splitPath(stripped));
    if (!rootSegments || !pathSegments) return null;
    if (pathSegments.length <= rootSegments.length) return null;
    const containedInRoot = rootSegments.every((seg, i) => pathSegments[i] === seg);
    if (!containedInRoot) return null;
    relSegments = pathSegments.slice(rootSegments.length);
  } else {
    const base = fromRelPath ? relativeDirOf(fromRelPath) : [];
    relSegments = normalizeSegments([...base, ...splitPath(stripped)]);
  }

  if (!relSegments || relSegments.length < 2) return null;

  const topDir = relSegments[0];
  if (!VIEWABLE_DIRS.some((dir) => dir === topDir)) return null;

  const relPath = relSegments.join("/");
  if (!isViewableFile(relPath)) return null;

  return relPath;
}
