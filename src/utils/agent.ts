// src/utils/agent.ts — frontend side of the worker connection.
// Spawns the Node.js worker via tauri-plugin-js and opens a type-safe kkrpc
// channel to it. Falls back to a connection error state if anything fails
// (Phase 0 basic error handling).

import { spawn, createChannel, onExit } from "tauri-plugin-js-api";
import type { FrontendAPI, WorkerAPI } from "../../shared/api";

const WORKER_NAME = "agent-worker";

export interface WorkerConnection {
  api: WorkerAPI;
  restart(): Promise<void>;
}

export async function connectWorker(
  frontendApi: FrontendAPI,
  onCrash: (code: number | null) => void,
): Promise<WorkerConnection> {
  async function boot(): Promise<WorkerAPI> {
    await spawn(WORKER_NAME, {
      runtime: "node",
      script: "backends/agent-worker.ts",
      args: ["--import", "tsx"],
    });
    await onExit(WORKER_NAME, onCrash);
    const { api } = await createChannel<FrontendAPI, WorkerAPI>(WORKER_NAME, frontendApi);
    return api;
  }

  let api = await boot();

  return {
    get api() {
      return api;
    },
    async restart() {
      api = await boot();
    },
  };
}
