// tests/support/global-config.ts — Isolated ~/.buddy/ for unit and BDD tests.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Vitest env stub API (also satisfied by importing `vi` from vitest). */
export interface EnvStub {
  stubEnv: (key: string, value: string) => void;
  unstubAllEnvs: () => void;
}

const buddyConfigDirStack: Array<string | undefined> = [];

export interface GlobalConfigFixture {
  configDir: string;
}

function writePromptFiles(
  configDir: string,
  options?: { agentsBase?: string; consolidationSkill?: string },
): void {
  const promptsDir = join(configDir, "prompts");
  mkdirSync(promptsDir, { recursive: true });

  if (options?.agentsBase !== undefined) {
    writeFileSync(join(promptsDir, "agents-base.md"), options.agentsBase, "utf8");
  }
  if (options?.consolidationSkill !== undefined) {
    writeFileSync(join(promptsDir, "consolidation.md"), options.consolidationSkill, "utf8");
  }
}

/** Point BUDDY_CONFIG_DIR at a temp dir; optional prompt files. */
export function setupGlobalConfigDir(
  options?: {
    agentsBase?: string;
    consolidationSkill?: string;
  },
  envStub?: EnvStub,
): GlobalConfigFixture {
  const configDir = mkdtempSync(join(tmpdir(), "buddy-global-config-"));

  if (envStub) {
    envStub.stubEnv("BUDDY_CONFIG_DIR", configDir);
  } else {
    buddyConfigDirStack.push(process.env.BUDDY_CONFIG_DIR);
    process.env.BUDDY_CONFIG_DIR = configDir;
  }

  writePromptFiles(configDir, options);

  return { configDir };
}

export function teardownGlobalConfigDir(configDir?: string, envStub?: EnvStub): void {
  if (envStub) {
    envStub.unstubAllEnvs();
  } else {
    const saved = buddyConfigDirStack.pop();
    if (saved === undefined) {
      delete process.env.BUDDY_CONFIG_DIR;
    } else {
      process.env.BUDDY_CONFIG_DIR = saved;
    }
  }

  if (configDir) {
    rmSync(configDir, { recursive: true, force: true });
  }
}
