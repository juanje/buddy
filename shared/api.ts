// shared/api.ts — Type-safe contract between frontend and worker (kkrpc).
// Event shapes verified against @earendil-works/pi-coding-agent 0.80.x .d.ts
// (Phase 0 spike): AgentSessionEvent in dist/core/agent-session.d.ts and
// AgentEvent in pi-agent-core dist/types.d.ts.

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

// Phase 1: used by FR-DEFERRED-01 (surface deferred items on session start).
export interface DeferredItem {
  text: string;
  dueDate: string;
}

export interface AgentState {
  model: string | undefined;
  thinkingLevel: string;
  isStreaming: boolean;
  messageCount: number;
}

// Phase 1: used by FR-SETUP-01/02 (first-run wizard configuration).
export interface SetupConfig {
  abDirectory: string;
  provider: "anthropic" | "openai" | "google" | "custom";
  model: string;
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
  shutdown(): Promise<void>;
}

/**
 * Session-scoped subset of WorkerAPI: what the chat needs once an AB is
 * configured. Setup concerns (detection, prerequisites) live in the worker
 * entry point because they must answer before any session exists.
 */
export type ChatWorkerAPI = Pick<WorkerAPI, "prompt" | "abort" | "getState" | "shutdown">;

/** Setup-scoped subset of WorkerAPI: what the wizard needs (FR-SETUP-02+). */
export type SetupWorkerAPI = Pick<
  WorkerAPI,
  "checkPrerequisites" | "getDefaultLocation" | "validateLocation"
>;

/** Worker calls these on the frontend. */
export interface FrontendAPI {
  onAgentEvent(event: AgentEvent): void;
  onWorkerError(error: string): void;
}
