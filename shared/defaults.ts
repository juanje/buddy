// shared/defaults.ts — Centralized operational defaults and security constants (NFR-CONFIG-01/03).

/** Global ~/.buddy/ schema version (NFR-MIGRATE). Increment when migrations are added. */
export const APP_SCHEMA_VERSION = 1;

// --- Operational defaults (NFR-CONFIG-01) ---
export const INCREMENTAL_REFLECT_EVERY = 15;
export const LOCK_STALE_MS = 60 * 60 * 1000;

/** Forked Pi sessions for background reflect (internal). */
export const REFLECT_SESSIONS_DIR = ".buddy/reflect-sessions";
/** App instrumentation logs (JSONL, machine-oriented). */
export const APP_LOGS_DIR = ".buddy/logs";
/** Fallback Pi provider when `.pi/settings.json` is missing or invalid. */
export const DEFAULT_PI_PROVIDER = "anthropic";

export const AGENT_TOOLS = ["read", "write", "edit", "grep", "find", "ls"] as const;
export const EXCLUDED_TOOLS = ["bash"] as const;
export const LOCK_RETRY_MS = 500;
export const LOCK_MAX_RETRIES = 20;
export const AUTH_FILE_MODE = 0o600;
export const DEFAULT_LANGUAGE = "es";
/** Default monthly spend cap for new installs (FR-COST-03). 0/null disables. */
export const DEFAULT_MONTHLY_BUDGET = 10;
/** Warn when monthly usage reaches this fraction of budget (FR-COST-03). */
export const BUDGET_WARNING_THRESHOLD = 0.8;
/** Global usage persistence file name under ~/.buddy/ (FR-COST-02). */
export const USAGE_FILE_NAME = "usage.json";
export const SHUTDOWN_TIMEOUT_MS = 2000;
export const GIT_USER_NAME = "Buddy";
export const GIT_USER_EMAIL = "buddy@localhost";

/** Heartbeat interval for deferred checks and consolidation evaluation (FR-DEFERRED-02, FR-CONSOL-01). */
export const HEARTBEAT_INTERVAL_MS = 30 * 60 * 1000;
/** Minimum gap between timer-triggered heartbeat ticks (guards runaway timer in compiled binaries). */
export const HEARTBEAT_MIN_TICK_MS = 5_000;
/** Argv flag for production sidecar reflect dispatch (E13b). */
export const REFLECT_ARGV_FLAG = "--reflect";
/** Env var set on spawned reflect children to prevent crash-recovery recursion. */
export const REFLECT_CHILD_ENV_KEY = "AB_REFLECT_CHILD";
export const REFLECT_CHILD_ENV_VALUE = "1";
/** Usage-based consolidation counters (FR-CONSOL-01). */
export const CONSOLIDATION_STATE_PATH = ".buddy/consolidation-state.json";
/** Consolidation run journal (FR-CONSOL-06). */
export const CONSOLIDATION_LOG_PATH = ".buddy/consolidation-log.json";

// --- Security constants (NFR-CONFIG-03) ---
export const DENYLIST_HOME_DIRS = [".ssh", ".gnupg", ".aws"];
export const DENYLIST_BASENAMES = [".env", "auth.json"];
export const WRITE_TOOLS = new Set(["write", "edit"]);
export const READ_TOOLS = new Set(["read", "ls", "find", "grep"]);
