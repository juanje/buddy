// backends/global-config.ts — ~/.buddy/ global config directory paths.

import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { GLOBAL_CONFIG_DIR_NAME } from "../shared/defaults";

/** Global config directory (~/.buddy/). Overridable in tests via BUDDY_CONFIG_DIR. */
export function globalConfigDir(): string {
  return process.env.BUDDY_CONFIG_DIR ?? join(homedir(), GLOBAL_CONFIG_DIR_NAME);
}

/**
 * Buddy's own Pi agent directory (NFR-SEC-19).
 *
 * The SDK's `getAgentDir()` returns `~/.pi/agent` — the user's Pi CLI setup.
 * That directory governs far more than credentials: skills, `settings.json`,
 * `tools/`, `extensions/`, `prompts/`, the project trust store and
 * `models.json`. Passing it meant NFR-AUTH-ISO isolated the credentials and
 * nothing else, so every Buddy session inherited whatever the user had
 * installed for a different tool.
 *
 * Observed in practice: a globally installed `wiki-kb` skill was advertised to
 * the agent, which tried to read it from `~/.pi/` — raising a Zone 3 permission
 * prompt for a file outside the workspace — only to find instructions requiring
 * bash, which Buddy does not have. Three layers of confusing failure, and a
 * permission prompt the user had no basis to judge.
 *
 * An empty directory yields no skills and no diagnostics, which is the intended
 * baseline; Buddy's own capabilities are registered as custom tools instead.
 */
export function buddyAgentDir(): string {
  const dir = join(globalConfigDir(), "agent");
  mkdirSync(dir, { recursive: true });
  return dir;
}
