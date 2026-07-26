// backends/global-config.ts — ~/.buddy/ global config directory path.

import { homedir } from "node:os";
import { join } from "node:path";

import { GLOBAL_CONFIG_DIR_NAME } from "../shared/defaults";

/** Global config directory (~/.buddy/). Overridable in tests via BUDDY_CONFIG_DIR. */
export function globalConfigDir(): string {
  return process.env.BUDDY_CONFIG_DIR ?? join(homedir(), GLOBAL_CONFIG_DIR_NAME);
}
