// backends/create-ab.ts — Deterministic AB instance creation (FR-SETUP-06).
// Pure file operations + git: NO LLM call happens here by design (the spec
// mandates it; personalization is a later, conversational step FR-SETUP-07).

import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { simpleGit } from "simple-git";

import type { SetupConfig } from "../shared/api";

/** Bundled templates location (dev: repo root; packaging revisits this). */
export function defaultTemplatesDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "templates");
}

export interface CreateAbOptions {
  config: SetupConfig;
  /** Where ~/.ab-app/config.json lives (injectable for tests). */
  configPath: string;
  templatesDir?: string;
}

/**
 * Create the AB home: copy templates (agent_brain/, user/, logs/, AGENTS.md),
 * write project Pi settings, init git with a single initial commit, and mark
 * the app as configured. Deterministic and offline.
 */
export async function createAbInstance(options: CreateAbOptions): Promise<void> {
  const { config, configPath } = options;
  const templatesDir = options.templatesDir ?? defaultTemplatesDir();
  const ab = config.abDirectory;

  cpSync(templatesDir, ab, { recursive: true });

  // Project-scoped Pi settings: the session created in this cwd uses the
  // provider/model chosen in the wizard (FR-SETTINGS-01).
  mkdirSync(join(ab, ".pi"), { recursive: true });
  writeFileSync(
    join(ab, ".pi", "settings.json"),
    JSON.stringify({ defaultProvider: config.provider, defaultModel: config.model }, null, 2) +
      "\n",
  );

  // Git identity is repo-local: the target user may have no global git
  // config, and setup must never fail on that (NFR: git invisible).
  const git = simpleGit(ab);
  await git.init();
  await git.addConfig("user.name", "AB");
  await git.addConfig("user.email", "ab@localhost");
  await git.add(".");
  await git.commit("chore: initial AB setup");

  // Written last: only a fully created AB counts as configured (FR-SETUP-01).
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}
