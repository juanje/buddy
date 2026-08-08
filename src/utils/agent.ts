// src/utils/agent.ts — frontend side of the worker connection.
// Spawns the Node.js worker via tauri-plugin-js and opens a type-safe kkrpc
// channel to it. Falls back to a connection error state if anything fails
// (Phase 0 basic error handling).

import { spawn, kill, createChannel, onExit, onStderr } from "tauri-plugin-js-api";
import type { FrontendAPI, WorkerAPI } from "../../shared/api";

const WORKER_NAME = "agent-worker";

export interface WorkerConnection {
  api: WorkerAPI;
  /**
   * Release everything this connection subscribed to (NFR-REL-10). Safe to call
   * more than once.
   */
  dispose(): Promise<void>;
}

export async function connectWorker(
  frontendApi: FrontendAPI,
  onCrash: (code: number | null) => void,
): Promise<WorkerConnection> {
  // Kill stale worker from HMR remount or prior restart before respawning.
  try {
    await kill(WORKER_NAME);
  } catch {
    // Not running — expected on first boot.
  }
  // Note: tauri-plugin-js appends `args` AFTER the script, so Node flags
  // must go through NODE_OPTIONS. cwd must be absolute: the Tauri process
  // runs from src-tauri/, not the project root.
  // Production: compiled sidecar (E12). Dev: Node + tsx against source tree.
  if (import.meta.env.PROD) {
    await spawn(WORKER_NAME, { sidecar: "agent-worker" });
  } else {
    await spawn(WORKER_NAME, {
      runtime: "node",
      script: "backends/agent-worker.ts",
      cwd: __BUDDY_PROJECT_ROOT__,
      env: { NODE_OPTIONS: "--import tsx" },
    });
  }
  const unlistenExit = await onExit(WORKER_NAME, onCrash);
  // The worker's fatal handler writes to stderr and then exits 1. Without this,
  // that exit reached the user as a bare "Worker exited (code 1)" and the reason
  // was nowhere — not in the terminal, not in a log.
  const unlistenStderr = await onStderr(WORKER_NAME, (data) => {
    console.error(`[agent-worker] ${data}`);
  });
  const { api, transport } = await createChannel<FrontendAPI, WorkerAPI>(
    WORKER_NAME,
    frontendApi,
  );

  // NFR-REL-10. Both subscriptions above are global Tauri event listeners
  // filtered by process name, and every worker is spawned under the same name.
  // Dropping them on the floor does not disconnect them from the *next* worker:
  // it subscribes a second reader to it. Two readers of one stdio stream meant
  // every event was handled twice and the chat rendered each delta twice.
  let disposed = false;
  async function dispose(): Promise<void> {
    if (disposed) return;
    disposed = true;
    unlistenExit();
    unlistenStderr();
    transport.close?.();
  }

  // A plain object, not a getter over a reassignable `api`. The getter existed
  // for an in-place reconnect that was never built: `boot()` ran once and `api`
  // was never reassigned. Reconnecting goes through connectWorker again (see
  // App.svelte's connect()), which produces a new connection object — and
  // worker-proxy re-reads it on every call precisely so that works.
  return { api, dispose };
}
