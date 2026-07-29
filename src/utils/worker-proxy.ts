// src/utils/worker-proxy.ts — WorkerAPI passthrough before the connection is ready.
//
// The UI renders before the worker connects, so every call has to survive
// `connection === undefined`. This used to be twenty hand-written method bodies
// repeating the same three lines, which had to be kept in step with WorkerAPI
// by hand: a method added to the interface and forgotten here produced an
// incomplete proxy with no error at the call site.
//
// The proxy forwards whatever it is asked for, so the interface is the only
// place a method is declared. The one decision left is what happens with no
// worker, and that is the table below.

import type { DeferredItemView, WorkerAPI } from "../../shared/api";
import type { WorkerConnection } from "./agent";

/**
 * Calls that resolve quietly when no worker is connected, and what they resolve
 * to. Everything else rejects — sending a prompt into the void is recoverable,
 * inventing a setup state is not, and a new method gets the safer default.
 */
const WITHOUT_WORKER: Partial<Record<keyof WorkerAPI, unknown>> = {
  prompt: undefined,
  abort: undefined,
  dismissDeferredItems: undefined,
  resolvePermission: undefined,
  shutdown: undefined,
  /** Rendered straight into the welcome state's list. */
  getDeferredItems: [] as DeferredItemView[],
};

export function createWorkerProxy(getConnection: () => WorkerConnection | undefined): WorkerAPI {
  return new Proxy({} as WorkerAPI, {
    get(_target, name) {
      // `await proxy` probes for `.then`, and a proxy that answers every
      // property with a function would have the await try to call it. Symbols
      // (Symbol.toPrimitive, inspection hooks) are not API methods either.
      if (typeof name !== "string" || name === "then") return undefined;

      return async (...args: unknown[]) => {
        // Re-read every call: connect() replaces the connection after a crash,
        // and a captured one would keep talking to a dead worker.
        const connection = getConnection();
        if (!connection) {
          if (name in WITHOUT_WORKER) return WITHOUT_WORKER[name as keyof WorkerAPI];
          throw new Error("worker not connected");
        }
        const method = connection.api[name as keyof WorkerAPI] as (...a: unknown[]) => unknown;
        return method.call(connection.api, ...args);
      };
    },
  });
}
