// backends/worker-core.ts — Testable core of the worker.
// Wraps a Pi session behind the WorkerAPI RPC surface and forwards session
// events to the frontend. The real entry point (agent-worker.ts) wires a real
// Pi AgentSession here; BDD tests wire a fake session that emits the same
// event shapes.

import type { AgentEvent, ChatWorkerAPI, FrontendAPI, PromptOptions } from "../shared/api";
import type { SessionLifecycle } from "./session-lifecycle";

/**
 * What the session core itself implements. Permission resolution lives in
 * the worker entry point (it owns the pending-request map), so it is
 * excluded here and composed into the RPC surface there.
 */
export type SessionWorkerAPI = Omit<ChatWorkerAPI, "resolvePermission" | "dismissDeferredItems"> & {
  setModel(model: unknown): Promise<void>;
};

/**
 * Structural subset of Pi's AgentSession that the worker core needs.
 * Verified against @earendil-works/pi-coding-agent 0.80.x AgentSession:
 *   prompt(text) → Promise<void>, abort() → Promise<void>,
 *   subscribe(listener) → unsubscribe, isStreaming getter, dispose().
 */
export interface PiSessionLike {
  prompt(text: string, options?: unknown): Promise<void>;
  abort(): Promise<void>;
  subscribe(listener: (event: AgentEvent) => void): () => void;
  setModel(model: unknown): Promise<void>;
  readonly isStreaming: boolean;
  dispose(): void;
}

export interface WorkerCoreOptions {
  lifecycle?: SessionLifecycle;
}

export interface WorkerCore {
  api: SessionWorkerAPI;
  dispose(): void;
  isStreaming(): boolean;
}

export function createWorkerCore(
  session: PiSessionLike,
  frontend: FrontendAPI,
  options?: WorkerCoreOptions,
): WorkerCore {
  const lifecycle = options?.lifecycle;
  const unsubscribe = session.subscribe((event) => {
    void lifecycle?.handleEvent(event);
    frontend.onAgentEvent(event);
  });

  const api: SessionWorkerAPI = {
    async prompt(text: string, _options?: PromptOptions): Promise<void> {
      const piOptions = _options?.images ? { images: _options.images } : undefined;
      await session.prompt(text, piOptions);
    },

    async abort(): Promise<void> {
      await session.abort();
    },

    async setModel(model: unknown): Promise<void> {
      await session.setModel(model);
    },

    async shutdown(): Promise<void> {
      if (session.isStreaming) {
        await session.abort();
      }
      await lifecycle?.flush();
      await lifecycle?.shutdown();
      session.dispose();
    },
  };

  return {
    api,
    dispose() {
      unsubscribe();
    },
    isStreaming() {
      return session.isStreaming;
    },
  };
}
