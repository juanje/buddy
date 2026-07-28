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
/**
 * Permissions for ~/.buddy/ and the state files inside it (NFR-SEC-17).
 *
 * auth.json used to be the only restricted file, but it is not the only one
 * worth reading: allowed-paths.json lists every directory the user has granted
 * access to, config.json names their buddy directory, usage.json records when
 * they were using it. Applied at creation — a file written at the umask default
 * and chmod-ed afterwards is readable by everyone for the interval in between.
 */
export const CONFIG_DIR_MODE = 0o700;
export const STATE_FILE_MODE = 0o600;
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
/** Prefix for auto-generated git commit messages (FR-GIT-01). */
export const GIT_COMMIT_PREFIX = "buddy:";

/** Global config directory name under homedir (~/.buddy/). */
export const GLOBAL_CONFIG_DIR_NAME = ".buddy";
export const CONFIG_FILE_NAME = "config.json";
export const AUTH_FILE_NAME = "auth.json";
export const ALLOWED_PATHS_FILE_NAME = "allowed-paths.json";

/** Legacy env var names (backward compat during AB→buddy rename). */
export const LEGACY_CONFIG_PATH_ENV = "AB_CONFIG_PATH";
export const LEGACY_AUTH_PATH_ENV = "AB_AUTH_PATH";
export const LEGACY_REFLECT_CHILD_ENV = "AB_REFLECT_CHILD";
export const LEGACY_DEBUG_ENV = "AB_DEBUG";

/** Heartbeat interval for deferred checks and consolidation evaluation (FR-DEFERRED-02, FR-CONSOL-01). */
export const HEARTBEAT_INTERVAL_MS = 30 * 60 * 1000;
/** Minimum gap between timer-triggered heartbeat ticks (guards runaway timer in compiled binaries). */
export const HEARTBEAT_MIN_TICK_MS = 5_000;
/** Argv flag for production sidecar reflect dispatch (E13b). */
export const REFLECT_ARGV_FLAG = "--reflect";
/** Maximum active log files before rotation archives older ones (FR-CONSOL-04). */
export const LOG_ROTATION_THRESHOLD = 28;
/** Env var set on spawned reflect children to prevent nested recursion. */
export const REFLECT_CHILD_ENV_KEY = "BUDDY_REFLECT_CHILD";
export const REFLECT_CHILD_ENV_VALUE = "1";
/**
 * Hard ceiling for a reflect child (FR-REFLECT-07). The child is detached and
 * unref'd, so nothing else supervises it: without this, a stalled provider
 * leaves a process alive after the user has closed the app. Generous enough for
 * one LLM call over a full conversation.
 */
export const REFLECT_CHILD_TIMEOUT_MS = 5 * 60 * 1000;
/**
 * Retention for forked session files in `.buddy/reflect-sessions/`
 * (NFR-MAINT-02). Each holds a full conversation transcript; they are kept only
 * as a manual-recovery window for a reflect that failed.
 */
export const REFLECT_FORK_RETENTION_DAYS = 7;
/** How long a git operation may wait for the repo lock (FR-REFLECT-06). */
export const GIT_LOCK_TIMEOUT_MS = 30_000;
/** Usage-based consolidation counters (FR-CONSOL-01). */
export const CONSOLIDATION_STATE_PATH = ".buddy/consolidation-state.json";
/** Consolidation run journal (FR-CONSOL-06). */
export const CONSOLIDATION_LOG_PATH = ".buddy/consolidation-log.json";
/**
 * Consecutive failures at one depth before it is abandoned and the user is told
 * (FR-CONSOL-09). Each attempt is a billed LLM call, so this is a spend ceiling
 * as much as a reliability one.
 */
export const CONSOLIDATION_RETRY_CEILING = 3;
/**
 * First retry delay after a failure; doubles per consecutive failure
 * (30 min → 1 h → 2 h). Matches the heartbeat interval so the first retry lands
 * on the next tick rather than being skipped.
 */
export const CONSOLIDATION_BACKOFF_BASE_MS = 30 * 60 * 1000;

/**
 * How long session boot may run before the UI says anything (FR-CHAT-13).
 *
 * Boot makes a full LLM call — the silent context injection — before the
 * session accepts prompts. On a commercial provider that is 1–3s and a notice
 * would only flicker; against a local model it was measured at 81s, where
 * silence reads as a hung app. Prompts typed meanwhile are queued either way.
 */
export const SESSION_PREPARING_NOTICE_MS = 2_500;

/** Max slug length for fetch_url download filenames (FR-NET-01). */
export const DOWNLOAD_SLUG_MAX_LEN = 80;
export const DOWNLOAD_DEFAULT_SLUG = "download";
/** Truncated session ID shown in logs and UI. */
export const SESSION_ID_DISPLAY_LENGTH = 8;

/** Hebbian report thresholds (consolidation-mechanics). */
export const HEBBIAN_RECENT_DAYS = 7;
export const HEBBIAN_DEMOTION_MIN_SESSIONS = 3;
export const RIPE_OBSERVATION_MIN_SEEN = 2;

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
/**
 * Timeout for the network calls the setup wizard makes (NFR-REL-09).
 *
 * Both sit on a user-facing path with a spinner and no cancel: validating the
 * API key, and listing models. Neither had a timeout, so a provider that
 * accepted the connection and then stalled left the wizard waiting forever with
 * nothing to click.
 */
export const PROVIDER_REQUEST_TIMEOUT_MS = 10_000;

// --- Security constants (NFR-CONFIG-03) ---
export const DENYLIST_HOME_DIRS = [".ssh", ".gnupg", ".aws"];
export const DENYLIST_BASENAMES = [".env", "auth.json"];
export const WRITE_TOOLS = new Set(["write", "edit"]);
export const READ_TOOLS = new Set(["read", "ls", "find", "grep"]);

/**
 * How many incomplete-frontmatter files one consolidation is asked to repair
 * (FR-BRAIN-07). A brain imported from another tool can list sixty at once,
 * which is a wall rather than a task and gets skipped entirely — observed on
 * 2026-07-28, when none of sixty were fixed. Later passes take the rest, so
 * the backlog drains instead of being ignored.
 */
export const BRAIN_HEALTH_REPAIR_BUDGET = 8;

/** Directories where delete/move/copy-dest are allowed (FR-DELETE-01, FR-FILE). */
export const USER_MUTABLE_DIRS = ["user", "downloads"] as const;
/** Directories never touched by user file ops (FR-DELETE-01, FR-FILE-02). */
export const PROTECTED_DIRS = ["agent_brain", "logs"] as const;
/** Root identity files that must never be deleted or moved (FR-DELETE-01). */
export const IDENTITY_ROOT_FILES = ["AGENTS.md", "SOUL.md", "USER.md", "CLAUDE.md"] as const;

/**
 * Directories an agent-authored link may point into (FR-CHAT-11). Everything
 * else — the buddy root itself, `.buddy/`, `.pi/`, `.git/` — is unreachable
 * from a chat link.
 */
export const VIEWABLE_DIRS = ["agent_brain", "user", "downloads", "logs"] as const;
/**
 * File types Buddy renders inline. Deliberately minimal: anything not on this
 * list is not clickable, because Buddy never hands a file to an external
 * program (FR-CHAT-11).
 */
export const VIEWABLE_EXTENSIONS = [".md", ".txt"] as const;
