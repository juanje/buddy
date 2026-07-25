// shared/defaults.ts — Centralized operational defaults and security constants (NFR-CONFIG-01/03).
// Browser-safe: no Node.js imports. Backend-only helpers live in backends/.

// --- Operational defaults (NFR-CONFIG-01) ---
export const LOCK_STALE_MS = 60 * 60 * 1000;
/** Retention period for .buddy/logs/*.jsonl session event logs (NFR-MAINT-01). */
export const SESSION_LOG_RETENTION_DAYS = 7;

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
/** Block new background tasks (reflect checkpoint, consolidation) at this fraction (FR-COST-03). */
export const BUDGET_BACKGROUND_THRESHOLD = 0.95;
/** Global usage persistence file name under ~/.buddy/ (FR-COST-02). */
export const USAGE_FILE_NAME = "usage.json";
export const SHUTDOWN_TIMEOUT_MS = 2000;
export const GIT_USER_NAME = "buddy";
export const GIT_USER_EMAIL = "buddy@localhost";

/** Heartbeat interval for deferred checks and consolidation evaluation (FR-DEFERRED-02, FR-CONSOL-01). */
export const HEARTBEAT_INTERVAL_MS = 30 * 60 * 1000;
/** Minimum gap between timer-triggered heartbeat ticks (guards runaway timer in compiled binaries). */
export const HEARTBEAT_MIN_TICK_MS = 5_000;
/** Argv flag for production sidecar reflect dispatch (E13b). */
export const REFLECT_ARGV_FLAG = "--reflect";
/** Maximum active log files before rotation archives older ones (FR-CONSOL-04). */
export const LOG_ROTATION_THRESHOLD = 28;
/** Env var set on spawned reflect children to prevent nested recursion. */
export const REFLECT_CHILD_ENV_KEY = "AB_REFLECT_CHILD";
export const REFLECT_CHILD_ENV_VALUE = "1";
/** Usage-based consolidation counters (FR-CONSOL-01). */
export const CONSOLIDATION_STATE_PATH = ".buddy/consolidation-state.json";
/** Consolidation run journal (FR-CONSOL-06). */
export const CONSOLIDATION_LOG_PATH = ".buddy/consolidation-log.json";

/** Required YAML frontmatter keys on agent_brain/ files (NFR-FORMAT-01). */
export const REQUIRED_BRAIN_FRONTMATTER = ["summary", "created"] as const;
/** Files exempt from frontmatter requirement (always-injected at session start). */
export const FRONTMATTER_EXEMPT_FILES = [
  "agent_brain/identity/SOUL.md",
  "agent_brain/identity/USER.md",
] as const;
/** Line count above which a brain file is flagged for potential split (FR-BRAIN-07). */
export const BRAIN_FILE_SIZE_THRESHOLD_LINES = 300;
/** Core agent_brain files that must exist (FR-BRAIN-07). */
export const CORE_BRAIN_FILES = [
  "agent_brain/identity/SOUL.md",
  "agent_brain/identity/USER.md",
  "agent_brain/deferred.md",
] as const;
/** Root overlay files — at least one must exist (FR-BRAIN-07). */
export const CORE_ROOT_FILES = ["AGENTS.md", "CLAUDE.md"] as const;
/** Root brain directory — structural files only, no index required. */
export const BRAIN_INDEX_EXEMPT_ROOT = "agent_brain";
/** Directories exempt from index.md requirement (USER.md parent pattern). */
export const BRAIN_INDEX_EXEMPT_DIRS = ["agent_brain/identity", "agent_brain/skills"] as const;

/** User-visible download directory under rootDir (FR-NET-01). */
export const DOWNLOADS_DIR = "downloads";
/** Maximum response size for fetch_url (FR-NET-01). */
export const FETCH_MAX_BYTES = 10 * 1024 * 1024;
/** HTTP timeout for fetch_url in milliseconds (FR-NET-01). */
export const FETCH_TIMEOUT_MS = 15_000;

// --- Security constants (NFR-CONFIG-03) ---
export const DENYLIST_HOME_DIRS = [".ssh", ".gnupg", ".aws"];
export const DENYLIST_BASENAMES = [".env", "auth.json"];
export const WRITE_TOOLS = new Set(["write", "edit"]);
export const READ_TOOLS = new Set(["read", "ls", "find", "grep"]);
