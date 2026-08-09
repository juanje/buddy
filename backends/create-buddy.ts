// backends/create-buddy.ts — Deterministic buddy instance creation (FR-SETUP-06/08).
// Pure file operations + git: NO LLM call happens here by design. The wizard
// collects personalization in a form; USER.md is populated from that data.

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { simpleGit } from "simple-git";

import type { SetupConfig } from "../shared/api";
import { DEFAULT_LANGUAGE, DEFAULT_MONTHLY_BUDGET, GIT_USER_EMAIL, GIT_USER_NAME } from "../shared/defaults";
import { getEmbeddedAssets } from "./embedded-assets";
import { writeStateFile } from "./state-file";
import { writePiSettings } from "../shared/pi-settings";
import { userProfilePath } from "./brain-paths";

/** Bundled templates location (dev: repo root; not present in the compiled sidecar). */
export function defaultTemplatesDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "templates");
}

/**
 * Materialize the buddy template tree at targetDir. Precedence: an explicit
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

export interface CreateBuddyOptions {
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

/**
 * Create the buddy home: copy templates (agent_brain/, user/, logs/, AGENTS.md),
 * write project Pi settings, init git with a single initial commit, and mark
 * the app as configured. Deterministic and offline.
 */
export async function createBuddyInstance(options: CreateBuddyOptions): Promise<void> {
  const { config, configPath } = options;
  const root = config.rootDir;

  copyTemplates(root, options.templatesDir);
  // NFR-PORT-08: even if a custom templatesDir omits it, new instances must not
  // inherit Git for Windows CRLF defaults alone.
  ensureTextEolAttributes(root);

  if (config.name?.trim()) {
    writeFileSync(userProfilePath(root), buildUserProfile(config));
  }

  // Project-scoped Pi settings: the session created in this cwd uses the
  // provider/model chosen in the wizard (FR-SETTINGS-01).
  writePiSettings(root, config);

  // Git identity is repo-local: the target user may have no global git
  // config, and setup must never fail on that (NFR: git invisible).
  const git = simpleGit(root);
  await git.init();
  await git.addConfig("user.name", GIT_USER_NAME);
  await git.addConfig("user.email", GIT_USER_EMAIL);
  await git.add(".");
  await git.commit("chore: initial Buddy setup");

  // Written last: only a fully created buddy instance counts as configured (FR-SETUP-01).
  markConfigured(config, configPath);
}

/**
 * Adopt an existing buddy directory without overwriting anything (FR-SETUP-10).
 * Platform artifacts (.cursor/, .codex/) are simply left alone. The only
 * write inside the buddy directory is .pi/settings.json, and only when it doesn't exist
 * (the wizard collected provider/model precisely because it was missing).
 */
export function adoptBuddyInstance(options: Pick<CreateBuddyOptions, "config" | "configPath">): void {
  const { config, configPath } = options;
  const settingsPath = join(config.rootDir, ".pi", "settings.json");

  if (!existsSync(settingsPath)) {
    writePiSettings(config.rootDir, config);
  }

  ensureRuntimeStateIgnored(config.rootDir);
  ensureTextEolAttributes(config.rootDir);
  markConfigured(config, configPath);
}

/**
 * Initialize a git repository in an adopted instance that has none
 * (FR-SETUP-12). Creates `.git` and commits nothing; content is untouched.
 *
 * A hand-made instance — the upstream template, a directory carried between
 * machines — legitimately arrives without a repo, and without one every
 * auto-commit fails silently for the life of the install.
 */
export async function ensureGitRepository(rootDir: string): Promise<boolean> {
  if (existsSync(join(rootDir, ".git"))) return false;
  const git = simpleGit(rootDir);
  await git.init();
  await git.addConfig("user.name", GIT_USER_NAME);
  await git.addConfig("user.email", GIT_USER_EMAIL);
  return true;
}

/**
 * Make sure `.buddy/` and `.pi/` are gitignored in an adopted instance.
 *
 * A deliberate exception to "adopt without modifying" (FR-SETUP-10). Without
 * these rules Buddy commits its own runtime state into the user's repository —
 * locks, consolidation state, session files — on every auto-commit. Creating or
 * extending `.gitignore` is a smaller intrusion than versioning our scratch
 * data in their history, and the only paths added are directories Buddy itself
 * creates.
 */
export function ensureRuntimeStateIgnored(rootDir: string): void {
  const gitignorePath = join(rootDir, ".gitignore");
  const required = [".buddy/", ".pi/"];

  let current = "";
  try {
    current = readFileSync(gitignorePath, "utf8");
  } catch {
    // Absent: created below with exactly the rules Buddy needs.
  }

  const lines = current.split("\n").map((line) => line.trim());
  const absent = required.filter((rule) => !lines.includes(rule));
  if (absent.length === 0) return;

  const needsNewline = current !== "" && !current.endsWith("\n");
  const header = current === "" ? "" : "\n# Added by Buddy: runtime state, not content\n";
  writeFileSync(
    gitignorePath,
    `${current}${needsNewline ? "\n" : ""}${header}${absent.join("\n")}\n`,
    "utf8",
  );
}

/** Canonical `.gitattributes` body for a new Buddy instance (NFR-PORT-08). */
export const BUDDY_GITATTRIBUTES = `\
# NFR-PORT-08 — keep text LF so a Buddy memory repo stays portable when created
# under Git for Windows (core.autocrlf=true). Binary files stay untouched.
* text=auto eol=lf
*.md text eol=lf
*.json text eol=lf
*.yml text eol=lf
*.yaml text eol=lf
`;

/**
 * Ensure `.gitattributes` forces LF for text (NFR-PORT-08).
 *
 * New installs get the file from `templates/`; this covers adopt and any
 * templatesDir that omitted it. Does not overwrite a file that already has the
 * `eol=lf` policy — the user's repo may already be deliberate.
 */
export function ensureTextEolAttributes(rootDir: string): void {
  const path = join(rootDir, ".gitattributes");
  let current = "";
  try {
    current = readFileSync(path, "utf8");
  } catch {
    writeFileSync(path, BUDDY_GITATTRIBUTES, "utf8");
    return;
  }
  if (/eol\s*=\s*lf/i.test(current)) return;
  const needsNewline = current !== "" && !current.endsWith("\n");
  writeFileSync(
    path,
    `${current}${needsNewline ? "\n" : ""}\n# Added by Buddy (NFR-PORT-08)\n* text=auto eol=lf\n`,
    "utf8",
  );
}

function markConfigured(config: SetupConfig, configPath: string): void {
  const payload: SetupConfig = {
    ...config,
    monthlyBudget: config.monthlyBudget ?? DEFAULT_MONTHLY_BUDGET,
  };
  writeStateFile(configPath, payload); // NFR-REL-08
}
