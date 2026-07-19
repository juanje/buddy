// backends/session-resume.ts — session resume on start (FR-SESSION-01).
// SessionManager.continueRecent picks the most recent session for the cwd
// and falls back to a fresh one when none exists (verified in the Phase 0
// spike: synchronous and non-nullable).

import { SessionManager } from "@earendil-works/pi-coding-agent";

export function resumeOrCreateSession(cwd: string, sessionDir?: string): SessionManager {
  return SessionManager.continueRecent(cwd, sessionDir);
}
