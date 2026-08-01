// scripts/snapshot-assets.ts — how a directory becomes an embedded snapshot.
//
// Shared by the generator and by `tests/unit/embedded-assets-sync.test.ts`, so
// the check compares the committed output against the same walk that produced
// it. A second implementation could disagree with the first about which files
// count, and then the test would be asserting its own opinion.

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Editor and OS leftovers, which are in the working tree and are not content.
 *
 * A blanket "skip anything starting with a dot" would be wrong: `templates/`
 * ships `.gitignore` and eight `.gitkeep` files, all tracked, and the `.gitkeep`
 * ones are the only reason those directories exist in a new instance at all.
 *
 * Found when a vim swap file in `bundled/prompts/` failed the sync test. In CI
 * it could never happen — a fresh checkout has no such files — but a local
 * `npm run build` would have embedded it in the sidecar.
 */
const NOT_CONTENT = /(^|\/)(\.DS_Store|\..*\.sw[a-z]|.*~)$/;

/** Snapshot a directory as relative path → contents, in POSIX spelling. */
export function snapshotDir(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const absolute = join(entry.parentPath, entry.name);
    const key = relative(dir, absolute).split(sep).join("/");
    if (NOT_CONTENT.test(key)) continue;
    files[key] = readFileSync(absolute, "utf8");
  }
  // Sorted so the generated file has a stable diff between runs.
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
}
