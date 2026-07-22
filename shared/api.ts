// shared/api.ts — Type-safe contract between frontend and worker (kkrpc).

/** Pi session event forwarded verbatim from worker to frontend. */
export interface AgentEvent {
  type: string;
  [key: string]: unknown;
}

/** Assistant message delta carried inside `message_update` events. */
export interface AssistantMessageEventLike {
  type: string;
  delta?: string;
  contentIndex?: number;
  [key: string]: unknown;
}

export interface AgentState {
  model: string | undefined;
  thinkingLevel: string;
  isStreaming: boolean;
  messageCount: number;
}

/** Options for prompt() — FR-INGEST-03/05 file and image attachments. */
export interface PromptOptions {
  attachments?: string[];
  images?: Array<{ type: "image"; data: string; mimeType: string }>;
}

// FR-SETUP-01/02: first-run wizard configuration.
export interface SetupConfig {
  rootDir: string;
  provider: "anthropic" | "openai" | "google" | "custom";
  model: string;
  language?: "es" | "en";
  name?: string;
  about?: string;
}

/** Result of first-run detection against ~/.buddy/config.json (FR-SETUP-01). */
export type SetupState = { firstRun: true } | { firstRun: false; config: SetupConfig };

/**
 * AB location validation result (FR-SETUP-03). "existing-ab" marks a
 * directory holding an AB instance, offered for import (FR-SETUP-08).
 */
export interface LocationCheck {
  status: "ok-new" | "ok-empty" | "existing-ab" | "not-empty" | "not-a-directory";
  /**
   * For "existing-ab": provider/model read from the instance's own
   * .pi/settings.json, when present. A complete pair allows direct adoption
   * without re-running the provider and model steps (FR-SETUP-08).
   */
  abSettings?: { provider?: string; model?: string };
}

/** API key validation verdict (FR-SETUP-04). */
export type KeyCheck = { valid: true } | { valid: false; error: string };

export type SetupProviderId = SetupConfig["provider"];

/** OAuth login result (FR-SETUP-05). */
export type OAuthLoginResult = { success: true } | { success: false; error: string };

/** Model entry for wizard model selection (live or curated). */
export interface ModelInfo {
  id: string;
  label: string;
  provider: SetupProviderId;
  tier?: "fast" | "balanced" | "powerful";
  recommended?: boolean;
}

/** Auth status for a Pi provider. */
export interface AuthProviderStatus {
  piProviderId: string;
  abProvider: SetupProviderId;
  hasAuth: boolean;
  authType?: "api_key" | "oauth";
}

export interface AuthStatusResult {
  providers: AuthProviderStatus[];
}

/** Events forwarded from worker during OAuth login (FR-SETUP-05). */
export type OAuthUIEvent =
  | { type: "auth_url"; url: string; instructions?: string }
  | { type: "device_code"; userCode: string; verificationUri: string; message?: string }
  | { type: "info"; message: string }
  | { type: "progress"; message: string }
  | {
      type: "prompt";
      requestId: number;
      promptType: string;
      message: string;
      options?: string[];
      placeholder?: string;
    }
  | { type: "complete" }
  | { type: "error"; message: string };

/** Persistent outside-path approval (FR-PERM-06). */
export interface AllowedPathPersist {
  path: string;
  type: "file" | "directory";
}

/** A permission question the agent is waiting on (FR-PERM-02/03/07). */
export interface PermissionRequest {
  id: number;
  kind: "identity-write" | "outside";
  op: "read" | "write";
  path: string;
}

/** System prerequisites report for the setup wizard (FR-SETUP-02). */
export interface PrereqStatus {
  gitInstalled: boolean;
  gitVersion?: string;
  /** Node's process.platform on the worker ("darwin" | "linux" | "win32" | …). */
  platform: string;
}

/** Due/overdue deferred item for the welcome banner (FR-DEFERRED-01 visual). */
export interface DeferredItemView {
  type: string;
  dueDate: string;
  source: string;
  text: string;
  overdue: boolean;
}

/** Frontend calls these on the worker. */
export interface WorkerAPI {
  prompt(text: string, options?: PromptOptions): Promise<void>;
  abort(): Promise<void>;
  getState(): Promise<AgentState>;
  /** Due/overdue deferred items for the chat welcome state (FR-DEFERRED-01). */
  getDeferredItems(): Promise<DeferredItemView[]>;
  /** Acknowledge due items: remove from deferred.md (FR-DEFERRED-01 dismiss). */
  dismissDeferredItems(): Promise<void>;
  getSetupState(): Promise<SetupState>;
  checkPrerequisites(): Promise<PrereqStatus>;
  getDefaultLocation(): Promise<string>;
  validateLocation(path: string): Promise<LocationCheck>;
  configureProviderKey(
    provider: SetupConfig["provider"],
    apiKey: string,
    baseUrl?: string,
  ): Promise<KeyCheck>;
  /** Browser OAuth login via Pi SDK (FR-SETUP-05). */
  loginOAuth(provider: SetupConfig["provider"]): Promise<OAuthLoginResult>;
  /** Answer a pending OAuth prompt from the SDK (select, manual_code, text). */
  answerOAuthPrompt(requestId: number, value: string): Promise<void>;
  /** Cancel an in-flight OAuth login. */
  cancelOAuthLogin(): Promise<void>;
  /** List models available for a provider (live SDK, curated fallback). */
  listModels(provider: SetupConfig["provider"]): Promise<ModelInfo[]>;
  /** Which providers have configured credentials. */
  getAuthStatus(): Promise<AuthStatusResult>;
  /**
   * Finish setup and boot the session. "create" builds a fresh AB from
   * templates (FR-SETUP-06); "import" adopts an existing one without
   * overwriting anything (FR-SETUP-08). Default: "create".
   */
  runSetup(config: SetupConfig, mode?: "create" | "import"): Promise<void>;
  /** Answer a pending permission request (FR-PERM-07). */
  resolvePermission(id: number, allow: boolean, persist?: AllowedPathPersist): Promise<void>;
  /** Merge settings into ~/.buddy/config.json (FR-SETTINGS-02). */
  updateConfig(patch: Partial<Pick<SetupConfig, "language">>): Promise<void>;
  /** Switch model mid-session and persist (FR-SETTINGS-03). */
  changeModel(provider: SetupConfig["provider"], model: string): Promise<void>;
  shutdown(): Promise<void>;
}

/**
 * Session-scoped subset of WorkerAPI: what the chat needs once an AB is
 * configured. Setup concerns (detection, prerequisites) live in the worker
 * entry point because they must answer before any session exists.
 */
export type ChatWorkerAPI = Pick<
  WorkerAPI,
  "prompt" | "abort" | "getState" | "resolvePermission" | "shutdown" | "dismissDeferredItems"
>;

/** Setup-scoped subset of WorkerAPI: what the wizard needs (FR-SETUP-02+). */
export type SetupWorkerAPI = Pick<
  WorkerAPI,
  | "checkPrerequisites"
  | "getDefaultLocation"
  | "validateLocation"
  | "configureProviderKey"
  | "loginOAuth"
  | "answerOAuthPrompt"
  | "cancelOAuthLogin"
  | "listModels"
  | "getAuthStatus"
  | "runSetup"
>;

/** Worker calls these on the frontend. */
export interface FrontendAPI {
  onAgentEvent(event: AgentEvent): void;
  onWorkerError(error: string): void;
  /** A tool call is waiting on the user's permission (FR-PERM-07). */
  onPermissionRequest(request: PermissionRequest): void;
  /** OAuth login progress (FR-SETUP-05). */
  onOAuthEvent(event: OAuthUIEvent): void;
  /** Deferred items surfaced by heartbeat (FR-DEFERRED-02). */
  onDeferredDue(items: DeferredItemView[]): void;
}
