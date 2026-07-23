// backends/migrations/migrate-0-to-1.ts — Schema v0→v1: populate ~/.buddy/prompts/ (NFR-MIGRATE).

import { cpSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getEmbeddedAssets } from "../embedded-assets";

/** Bundled prompt sources shipped with the app (not copied into rootDir). */
export function bundledPromptsDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..", "bundled", "prompts");
}

/** Create ~/.buddy/prompts/ and copy all bundled prompt files. Idempotent. */
export function migrate_0_to_1(configDir: string): void {
  const targetDir = join(configDir, "prompts");
  mkdirSync(targetDir, { recursive: true });

  // Compiled sidecar: bundled/prompts/ is not on disk — write the embedded copies.
  const embedded = getEmbeddedAssets();
  if (embedded) {
    for (const [name, content] of Object.entries(embedded.prompts)) {
      if (!name.endsWith(".md")) continue;
      writeFileSync(join(targetDir, name), content, "utf8");
    }
    return;
  }

  const sourceDir = bundledPromptsDir();
  for (const name of readdirSync(sourceDir)) {
    if (!name.endsWith(".md")) continue;
    cpSync(join(sourceDir, name), join(targetDir, name), { force: true });
  }
}
