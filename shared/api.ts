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

// FR-SETUP-01/02: first-run wizard configuration.
export interface SetupConfig {
  abDirectory: string;
  provider: "anthropic" | "openai" | "google" | "custom";
  model: string;
  language?: "es" | "en";
  name?: string;
  about?: string;
  apiKey?: string;
  baseUrl?: string;
}

/** Result of first-run detection against ~/.ab-app/config.json (FR-SETUP-01). */
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

/** Pre-existing Pi auth detected on the system (bypass provider/model steps). */
export interface DetectedAuth {
  provider: SetupConfig["provider"];
  model: string;
  /** All valid providers found, for letting the user choose. */
  options?: Array<{ piProvider: string; provider: SetupConfig["provider"]; model: string }>;
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

/** Frontend calls these on the worker. */
export interface WorkerAPI {
  prompt(text: string): Promise<void>;
  abort(): Promise<void>;
  getState(): Promise<AgentState>;
  getSetupState(): Promise<SetupState>;
  checkPrerequisites(): Promise<PrereqStatus>;
  getDefaultLocation(): Promise<string>;
  validateLocation(path: string): Promise<LocationCheck>;
  configureProviderKey(
    provider: SetupConfig["provider"],
    apiKey: string,
    baseUrl?: string,
  ): Promise<KeyCheck>;
  /** Detect an existing Pi auth with valid credentials (skip provider step). */
  detectExistingAuth(): Promise<DetectedAuth | null>;
  /**
   * Finish setup and boot the session. "create" builds a fresh AB from
   * templates (FR-SETUP-06); "import" adopts an existing one without
   * overwriting anything (FR-SETUP-08). Default: "create".
   */
  runSetup(config: SetupConfig, mode?: "create" | "import"): Promise<void>;
  /** Answer a pending permission request (FR-PERM-07). */
  resolvePermission(id: number, allow: boolean): Promise<void>;
  shutdown(): Promise<void>;
}

/**
 * Session-scoped subset of WorkerAPI: what the chat needs once an AB is
 * configured. Setup concerns (detection, prerequisites) live in the worker
 * entry point because they must answer before any session exists.
 */
export type ChatWorkerAPI = Pick<
  WorkerAPI,
  "prompt" | "abort" | "getState" | "resolvePermission" | "shutdown"
>;

/** Setup-scoped subset of WorkerAPI: what the wizard needs (FR-SETUP-02+). */
export type SetupWorkerAPI = Pick<
  WorkerAPI,
  | "checkPrerequisites"
  | "getDefaultLocation"
  | "validateLocation"
  | "configureProviderKey"
  | "detectExistingAuth"
  | "runSetup"
>;

/** Worker calls these on the frontend. */
export interface FrontendAPI {
  onAgentEvent(event: AgentEvent): void;
  onWorkerError(error: string): void;
  /** A tool call is waiting on the user's permission (FR-PERM-07). */
  onPermissionRequest(request: PermissionRequest): void;
}
