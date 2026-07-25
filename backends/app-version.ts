// backends/app-version.ts — Runtime app semver (NFR-MIGRATE-06).
// In the compiled sidecar, package.json doesn't exist on disk — the
// build-time embedded version (registered via sidecar-entry.ts) is used.
// In dev mode, falls back to reading package.json from the repo tree.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getEmbeddedAssets } from "./embedded-assets";

function readAppVersion(): string {
  const embedded = getEmbeddedAssets();
  if (embedded?.appVersion) return embedded.appVersion;

  try {
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export const APP_VERSION = readAppVersion();
