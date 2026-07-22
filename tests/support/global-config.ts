// tests/support/global-config.ts — Isolated ~/.buddy/ for unit and BDD tests.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let savedBuddyConfigDir: string | undefined;

export interface GlobalConfigFixture {
  configDir: string;
}

/** Point BUDDY_CONFIG_DIR at a temp dir; optional prompt files. */
export function setupGlobalConfigDir(options?: {
  agentsBase?: string;
  consolidationSkill?: string;
}): GlobalConfigFixture {
  const configDir = mkdtempSync(join(tmpdir(), "ab-global-config-"));
  savedBuddyConfigDir = process.env.BUDDY_CONFIG_DIR;
  process.env.BUDDY_CONFIG_DIR = configDir;

  const promptsDir = join(configDir, "prompts");
  mkdirSync(promptsDir, { recursive: true });

  if (options?.agentsBase !== undefined) {
    writeFileSync(join(promptsDir, "agents-base.md"), options.agentsBase, "utf8");
  }
  if (options?.consolidationSkill !== undefined) {
    writeFileSync(join(promptsDir, "consolidation.md"), options.consolidationSkill, "utf8");
  }

  return { configDir };
}

export function teardownGlobalConfigDir(configDir?: string): void {
  if (savedBuddyConfigDir === undefined) {
    delete process.env.BUDDY_CONFIG_DIR;
  } else {
    process.env.BUDDY_CONFIG_DIR = savedBuddyConfigDir;
  }
  savedBuddyConfigDir = undefined;

  if (configDir) {
    rmSync(configDir, { recursive: true, force: true });
  }
}
