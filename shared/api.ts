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

export interface SetupConfig {
  abDirectory: string;
  provider: string; // "anthropic" | "openai" | "google" | "custom"
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

/** Frontend calls these on the worker. */
export interface WorkerAPI {
  prompt(text: string): Promise<void>;
  abort(): Promise<void>;
  getState(): Promise<AgentState>;
  shutdown(): Promise<void>;
}

/** Worker calls these on the frontend. */
export interface FrontendAPI {
  onAgentEvent(event: AgentEvent): void;
  onWorkerError(error: string): void;
}
