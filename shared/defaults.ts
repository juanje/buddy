// shared/defaults.ts — Centralized operational defaults and security constants (NFR-CONFIG-01/03).

/** Global ~/.buddy/ schema version (NFR-MIGRATE). Increment when migrations are added. */
export const APP_SCHEMA_VERSION = 1;

// --- Operational defaults (NFR-CONFIG-01) ---
export const INCREMENTAL_REFLECT_EVERY = 15;
export const LOCK_STALE_MS = 60 * 60 * 1000;
export const CRASH_RECOVERY_MAX = 3;

/** Internal reflect queue (not agent-visible). */
export const PENDING_DIR = ".buddy/pending";
/** Forked Pi sessions for background reflect (internal). */
export const REFLECT_SESSIONS_DIR = ".buddy/reflect-sessions";
/** App instrumentation logs (JSONL, machine-oriented). */
export const APP_LOGS_DIR = ".buddy/logs";
/** Max pending reflects processed per catch-up run. */
export const CATCH_UP_MAX = 3;
/** Fallback Pi provider when `.pi/settings.json` is missing or invalid. */
export const DEFAULT_PI_PROVIDER = "anthropic";

export const AGENT_TOOLS = ["read", "write", "edit", "grep", "find", "ls"] as const;
export const EXCLUDED_TOOLS = ["bash"] as const;
export const LOCK_RETRY_MS = 500;
export const LOCK_MAX_RETRIES = 20;
export const AUTH_FILE_MODE = 0o600;
export const DEFAULT_LANGUAGE = "es";
export const SHUTDOWN_TIMEOUT_MS = 2000;
export const GIT_USER_NAME = "Buddy";
export const GIT_USER_EMAIL = "buddy@localhost";

/** Heartbeat interval for deferred checks and consolidation evaluation (FR-DEFERRED-02, FR-CONSOL-01). */
export const HEARTBEAT_INTERVAL_MS = 30 * 60 * 1000;
/** Usage-based consolidation counters (FR-CONSOL-01). */
export const CONSOLIDATION_STATE_PATH = ".buddy/consolidation-state.json";
/** Consolidation run journal (FR-CONSOL-06). */
export const CONSOLIDATION_LOG_PATH = ".buddy/consolidation-log.json";

// --- Security constants (NFR-CONFIG-03) ---
export const DENYLIST_HOME_DIRS = [".ssh", ".gnupg", ".aws"];
export const DENYLIST_BASENAMES = [".env", "auth.json"];
export const WRITE_TOOLS = new Set(["write", "edit"]);
export const READ_TOOLS = new Set(["read", "ls", "find", "grep"]);
