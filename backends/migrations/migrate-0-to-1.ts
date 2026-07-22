// backends/migrations/migrate-0-to-1.ts — Schema v0→v1: populate ~/.buddy/prompts/ (NFR-MIGRATE).

import { cpSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Bundled prompt sources shipped with the app (not copied into rootDir). */
export function bundledPromptsDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..", "bundled", "prompts");
}

/** Create ~/.buddy/prompts/ and copy all bundled prompt files. Idempotent. */
export function migrate_0_to_1(configDir: string): void {
  const targetDir = join(configDir, "prompts");
  mkdirSync(targetDir, { recursive: true });

  const sourceDir = bundledPromptsDir();
  for (const name of readdirSync(sourceDir)) {
    if (!name.endsWith(".md")) continue;
    cpSync(join(sourceDir, name), join(targetDir, name), { force: true });
  }
}
