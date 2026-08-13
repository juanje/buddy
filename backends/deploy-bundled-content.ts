// backends/deploy-bundled-content.ts — deploy bundled prompts and docs to ~/.buddy/ (NFR-MIGRATE-06).

import { cpSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getEmbeddedAssets } from "./embedded-assets";

/** Bundled prompt sources shipped with the app (not copied into rootDir). */
export function bundledPromptsDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "bundled", "prompts");
}

/** Bundled self-documentation pages shipped with the app (FR-DOCS-01). */
export function bundledDocsDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "bundled", "docs");
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
      const filePath = join(targetDir, name);
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, content, "utf8");
    }
    return;
  }

  for (const name of readdirSync(sourceDir)) {
    if (!name.endsWith(".md")) continue;
    cpSync(join(sourceDir, name), join(targetDir, name), { force: true });
  }
}

/** Overwrite ~/.buddy/prompts/ and ~/.buddy/docs/ from bundled/embedded sources. Idempotent. */
export function deployBundledGlobalContent(configDir: string): void {
  deployBundledPrompts(configDir);
  deployBundledDocs(configDir);
}

/** Deploy prompts only — needed before session creation (system prompt assembly). */
export function deployBundledPrompts(configDir: string): void {
  const embedded = getEmbeddedAssets();
  deployMarkdownFiles(
    bundledPromptsDir(),
    join(configDir, "prompts"),
    embedded?.prompts,
  );
}

/** Deploy docs only — can run after RPC channel is up (read on demand by the agent). */
export function deployBundledDocs(configDir: string): void {
  const embedded = getEmbeddedAssets();
  deployMarkdownFiles(
    bundledDocsDir(),
    join(configDir, "docs"),
    embedded?.docs,
  );
}
