// shared/connector-types.ts — Service connector shared types (FR-CONN-01/06).

/** Per-integration configuration stored in ~/.buddy/integrations/<domain>.json */
export interface ConnectorConfig {
  enabled?: boolean;
  baseUrl?: string;
  /** Jira: email for Basic auth. Slack: not used. */
  email?: string;
  /** Primary secret (API token, xoxc, etc.). */
  token?: string;
  /** Secondary secret (Slack xoxd cookie). */
  cookie?: string;
  /** Issue key patterns for bulk refresh, e.g. ["VROOM-\\d+"]. */
  issueKeyPatterns?: string[];
  [key: string]: unknown;
}

export type ActionClassification = "read" | "write";

/** Declarative action → read/write table for one connector domain. */
export type ActionTable = Record<string, ActionClassification>;

export interface ConnectorError {
  error: string;
  code: number;
  recoverable: boolean;
  suggestion: string;
}

/** Standard dispatcher result (§17.6). */
export interface ConnectorResult {
  data: string;
  stale: boolean;
  synced_at?: string;
  error?: ConnectorError;
}

/** Metadata carried on cached entries (entity store, query store, thread frontmatter). */
export interface CacheEntryMeta {
  synced_at: string;
  stale_after: string;
  source?: string;
}

export type CacheEntry = CacheEntryMeta & Record<string, unknown>;
