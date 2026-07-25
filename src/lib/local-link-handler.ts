// src/lib/local-link-handler.ts — Route local markdown links (FR-CHAT-09/10).

import { isViewableFile, resolveLocalPathForOpen } from "./local-path";

export type LocalLinkAction =
  | { type: "view"; absPath: string }
  | { type: "open"; absPath: string };

/** Resolve a local link click into viewer or system-open action. */
export function routeLocalLinkClick(rootDir: string, rawHref: string): LocalLinkAction | null {
  const absPath = resolveLocalPathForOpen(rootDir, rawHref);
  if (!absPath) return null;
  if (isViewableFile(absPath)) {
    return { type: "view", absPath };
  }
  return { type: "open", absPath };
}
