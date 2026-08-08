// backends/session-paths.ts — Pi session storage paths (NFR-SEC-19).

import { join } from "node:path";

import { SESSIONS_DIR } from "../shared/defaults";

/** Live Pi session JSONL directory for a buddy instance root. */
export function buddySessionsDir(rootDir: string): string {
  return join(rootDir, SESSIONS_DIR);
}
