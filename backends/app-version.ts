// backends/app-version.ts — Runtime app semver from package.json (NFR-MIGRATE-06).
// Lives in backends/ because it uses Node.js fs — not importable from the frontend.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function readAppVersion(): string {
  try {
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export const APP_VERSION = readAppVersion();
