// backends/worker-core.ts — Testable core of the worker.
// Wraps a Pi session behind the WorkerAPI RPC surface and forwards session
// events to the frontend. The real entry point (agent-worker.ts) wires a real
// Pi AgentSession here; BDD tests wire a fake session that emits the same
// event shapes.

import type { AgentEvent, AgentState, ChatWorkerAPI, FrontendAPI } from "../shared/api";

/**
 * Structural subset of Pi's AgentSession that the worker core needs.
 * Verified against @earendil-works/pi-coding-agent 0.80.x AgentSession:
 *   prompt(text) → Promise<void>, abort() → Promise<void>,
 *   subscribe(listener) → unsubscribe, isStreaming getter, dispose().
 */
export interface PiSessionLike {
  prompt(text: string): Promise<void>;
  abort(): Promise<void>;
  subscribe(listener: (event: AgentEvent) => void): () => void;
  readonly isStreaming: boolean;
  dispose(): void;
}

export interface WorkerCore {
  api: ChatWorkerAPI;
  dispose(): void;
}

export function createWorkerCore(session: PiSessionLike, frontend: FrontendAPI): WorkerCore {
  const unsubscribe = session.subscribe((event) => {
    frontend.onAgentEvent(event);
  });

  const api: ChatWorkerAPI = {
    async prompt(text: string): Promise<void> {
      await session.prompt(text);
    },

    async abort(): Promise<void> {
      await session.abort();
    },

    async getState(): Promise<AgentState> {
      return {
        model: undefined,
        thinkingLevel: "medium",
        isStreaming: session.isStreaming,
        messageCount: 0,
      };
    },

    async shutdown(): Promise<void> {
      session.dispose();
    },
  };

  return {
    api,
    dispose() {
      unsubscribe();
    },
  };
}
