// backends/deploy-bundled-content.ts — deploy bundled prompts and docs to ~/.buddy/ (NFR-MIGRATE-06).

import { cpSync, existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
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

/** Bundled format references deployed to ~/.buddy/templates/ (FR-SKILL-06). */
export function bundledTemplatesDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "bundled", "templates");
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

  for (const entry of readdirSync(sourceDir, { recursive: true })) {
    const name = String(entry);
    if (!name.endsWith(".md")) continue;
    const filePath = join(targetDir, name);
    mkdirSync(dirname(filePath), { recursive: true });
    cpSync(join(sourceDir, name), filePath, { force: true });
  }
}

/** Overwrite ~/.buddy/prompts/ and ~/.buddy/docs/ from bundled/embedded sources. Idempotent. */
export function deployBundledGlobalContent(configDir: string): void {
  deployBundledPrompts(configDir);
  deployBundledDocs(configDir);
  deployBundledTemplates(configDir);
}

/** Remove .md files in targetDir that are not in the deployed set. */
function removeOrphanedMarkdown(targetDir: string, deployedNames: Set<string>): void {
  if (!existsSync(targetDir)) return;
  for (const entry of readdirSync(targetDir, { recursive: true })) {
    const name = String(entry);
    if (!name.endsWith(".md")) continue;
    if (!deployedNames.has(name)) {
      const orphan = join(targetDir, name);
      if (existsSync(orphan)) unlinkSync(orphan);
    }
  }
}

/** Deploy prompts only — needed before session creation (system prompt assembly). */
export function deployBundledPrompts(configDir: string): void {
  const embedded = getEmbeddedAssets();
  const promptsTargetDir = join(configDir, "prompts");
  deployMarkdownFiles(
    bundledPromptsDir(),
    promptsTargetDir,
    embedded?.prompts,
  );
  const deployedNames = new Set(
    embedded?.prompts
      ? Object.keys(embedded.prompts).filter((n) => n.endsWith(".md"))
      : [...readdirSync(bundledPromptsDir(), { recursive: true })]
          .map(String)
          .filter((n) => n.endsWith(".md")),
  );
  removeOrphanedMarkdown(promptsTargetDir, deployedNames);
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

/** Deploy bundled format references to ~/.buddy/templates/ (FR-SKILL-06). */
export function deployBundledTemplates(configDir: string): void {
  const embedded = getEmbeddedAssets();
  const sourceDir = bundledTemplatesDir();
  if (!existsSync(sourceDir) && !embedded?.bundledTemplates) return;

  const targetDir = join(configDir, "templates");
  deployMarkdownFiles(sourceDir, targetDir, embedded?.bundledTemplates);
}
