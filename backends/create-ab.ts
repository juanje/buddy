// backends/create-ab.ts — Deterministic AB instance creation (FR-SETUP-06/08).
// Pure file operations + git: NO LLM call happens here by design. The wizard
// collects personalization in a form; USER.md is populated from that data.

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { simpleGit } from "simple-git";

import type { SetupConfig } from "../shared/api";
import { DEFAULT_LANGUAGE, GIT_USER_EMAIL, GIT_USER_NAME } from "../shared/defaults";
import { getEmbeddedAssets } from "./embedded-assets";
import { writePiSettings } from "../shared/pi-settings";

/** Bundled templates location (dev: repo root; not present in the compiled sidecar). */
export function defaultTemplatesDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "templates");
}

/**
 * Materialize the AB template tree at targetDir. Precedence: an explicit
 * templatesDir (tests) > assets embedded in the compiled sidecar > repo
 * templates/ on disk (dev).
 */
export function copyTemplates(targetDir: string, templatesDir?: string): void {
  if (templatesDir) {
    cpSync(templatesDir, targetDir, { recursive: true });
    return;
  }

  const embedded = getEmbeddedAssets();
  if (embedded) {
    for (const [path, content] of Object.entries(embedded.templates)) {
      const target = join(targetDir, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content, "utf8");
    }
    return;
  }

  cpSync(defaultTemplatesDir(), targetDir, { recursive: true });
}

export interface CreateAbOptions {
  config: SetupConfig;
  /** Where ~/.buddy/config.json lives (injectable for tests). */
  configPath: string;
  templatesDir?: string;
}

/** Build USER.md from wizard form data — no template prose remains (FR-SETUP-08). */
export function buildUserProfile(config: SetupConfig): string {
  const name = config.name?.trim() ?? "";
  const about = config.about?.trim() || "(to be discovered)";
  const language = config.language ?? DEFAULT_LANGUAGE;
  return `# User profile

## About

- **Name:** ${name}

## Context

${about}

## Preferences

- Language: ${language}
`;
}

export { writePiSettings } from "../shared/pi-settings";

/**
 * Create the AB home: copy templates (agent_brain/, user/, logs/, AGENTS.md),
 * write project Pi settings, init git with a single initial commit, and mark
 * the app as configured. Deterministic and offline.
 */
export async function createAbInstance(options: CreateAbOptions): Promise<void> {
  const { config, configPath } = options;
  const ab = config.rootDir;

  copyTemplates(ab, options.templatesDir);

  if (config.name?.trim()) {
    writeFileSync(join(ab, "agent_brain", "identity", "USER.md"), buildUserProfile(config));
  }

  // Project-scoped Pi settings: the session created in this cwd uses the
  // provider/model chosen in the wizard (FR-SETTINGS-01).
  writePiSettings(ab, config);

  // Git identity is repo-local: the target user may have no global git
  // config, and setup must never fail on that (NFR: git invisible).
  const git = simpleGit(ab);
  await git.init();
  await git.addConfig("user.name", GIT_USER_NAME);
  await git.addConfig("user.email", GIT_USER_EMAIL);
  await git.add(".");
  await git.commit("chore: initial Buddy setup");

  // Written last: only a fully created AB counts as configured (FR-SETUP-01).
  markConfigured(config, configPath);
}

/**
 * Adopt an existing AB directory without overwriting anything (FR-SETUP-10).
 * Platform artifacts (.cursor/, .codex/) are simply left alone. The only
 * write inside the AB is .pi/settings.json, and only when it doesn't exist
 * (the wizard collected provider/model precisely because it was missing).
 */
export function adoptAbInstance(options: Pick<CreateAbOptions, "config" | "configPath">): void {
  const { config, configPath } = options;
  const settingsPath = join(config.rootDir, ".pi", "settings.json");

  if (!existsSync(settingsPath)) {
    writePiSettings(config.rootDir, config);
  }

  markConfigured(config, configPath);
}

function markConfigured(config: SetupConfig, configPath: string): void {
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}
