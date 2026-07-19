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

/** Frontend calls these on the worker. */
export interface WorkerAPI {
  prompt(text: string): Promise<void>;
  abort(): Promise<void>;
  getState(): Promise<AgentState>;
  getSetupState(): Promise<SetupState>;
  shutdown(): Promise<void>;
}

/**
 * Session-scoped subset of WorkerAPI: what the chat needs once an AB is
 * configured. Setup detection lives in the worker entry point because it
 * must answer before any session exists (FR-SETUP-01).
 */
export type ChatWorkerAPI = Omit<WorkerAPI, "getSetupState">;

/** Worker calls these on the frontend. */
export interface FrontendAPI {
  onAgentEvent(event: AgentEvent): void;
  onWorkerError(error: string): void;
}
