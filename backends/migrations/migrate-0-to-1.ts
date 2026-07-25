// backends/migrations/migrate-0-to-1.ts — Schema v0→v1: populate ~/.buddy/prompts/ and docs/ (NFR-MIGRATE).

import { cpSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getEmbeddedAssets } from "../embedded-assets";

/** Bundled prompt sources shipped with the app (not copied into rootDir). */
export function bundledPromptsDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..", "bundled", "prompts");
}

/** Bundled self-documentation pages shipped with the app (FR-DOCS-01). */
export function bundledDocsDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..", "bundled", "docs");
}

function deployMarkdownFiles(
  sourceDir: string,
  targetDir: string,
  embeddedFiles: Record<string, string> | undefined,
): void {
  mkdirSync(targetDir, { recursive: true });

  if (embeddedFiles) {
    for (const [name, content] of Object.entries(embeddedFiles)) {
      if (!name.endsWith(".md")) continue;
      writeFileSync(join(targetDir, name), content, "utf8");
    }
    return;
  }

  for (const name of readdirSync(sourceDir)) {
    if (!name.endsWith(".md")) continue;
    cpSync(join(sourceDir, name), join(targetDir, name), { force: true });
  }
}

/** Create ~/.buddy/prompts/ and ~/.buddy/docs/. Copy all bundled files. Idempotent. */
export function migrate_0_to_1(configDir: string): void {
  const embedded = getEmbeddedAssets();

  deployMarkdownFiles(
    bundledPromptsDir(),
    join(configDir, "prompts"),
    embedded?.prompts,
  );

  deployMarkdownFiles(
    bundledDocsDir(),
    join(configDir, "docs"),
    embedded?.docs,
  );
}
