// src/lib/local-link-handler.ts — Route local markdown links (FR-CHAT-09/10/11).
//
// There is exactly one outcome: view it inside Buddy, or refuse. The "open with
// the system app" branch was removed in the H1 hardening sprint — Buddy never
// hands a file to an external program.

import { resolveViewablePath } from "../../shared/viewable-path";

export type LocalLinkAction = { type: "view"; relPath: string };

/**
 * Decide what a click on a local link should do. Returns null when the link
 * must not be followed — a non-viewable file type, or a target outside the
 * four user-facing directories.
 *
 * Presentational only: the worker validates again before reading anything
 * (NFR-SEC-08).
 */
export function routeLocalLinkClick(rootDir: string, rawHref: string): LocalLinkAction | null {
  const relPath = resolveViewablePath(rootDir, rawHref);
  return relPath ? { type: "view", relPath } : null;
}
