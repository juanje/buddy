// shared/defaults.ts — Centralized operational defaults and security constants (NFR-CONFIG-01/03).

// --- Operational defaults (NFR-CONFIG-01) ---
export const INCREMENTAL_REFLECT_EVERY = 15;
export const LOCK_STALE_MS = 60 * 60 * 1000;
export const CRASH_RECOVERY_MAX = 3;

/** Internal reflect queue (not agent-visible). */
export const PENDING_DIR = ".ab-app/pending";
/** App instrumentation logs (JSONL, machine-oriented). */
export const APP_LOGS_DIR = ".ab-app/logs";

// --- Security constants (NFR-CONFIG-03) ---
export const DENYLIST_HOME_DIRS = [".ssh", ".gnupg", ".aws"];
export const DENYLIST_BASENAMES = [".env", "auth.json"];
export const WRITE_TOOLS = new Set(["write", "edit"]);
export const READ_TOOLS = new Set(["read", "ls", "find", "grep"]);
