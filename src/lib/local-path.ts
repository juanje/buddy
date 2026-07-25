// src/lib/local-path.ts — resolve local markdown links for FR-CHAT-09 (browser-safe).

/** True when the href should open in the system browser, not via shell.open(). */
export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function normalizeSlashes(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

/**
 * Resolve a local markdown link against rootDir for shell.open().
 * Returns null for external URLs or paths outside the buddy home.
 */
export function resolveLocalPathForOpen(rootDir: string, rawHref: string): string | null {
  if (isExternalHref(rawHref)) return null;

  const stripped = rawHref.replace(/^file:\/\//, "");
  const root = normalizeSlashes(rootDir);
  const abs = stripped.startsWith("/")
    ? normalizeSlashes(stripped)
    : normalizeSlashes(`${root}/${stripped.replace(/^\.\//, "")}`);

  if (abs === root || abs.startsWith(`${root}/`)) {
    return abs;
  }
  return null;
}

/** True when the file extension should render in the inline viewer (FR-CHAT-10). */
export function isViewableFile(path: string): boolean {
  return /\.(md|txt)$/i.test(path);
}
