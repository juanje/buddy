// backends/agent-worker.ts — Worker entry point (Phase 0).
// Spawned by tauri-plugin-js inside the Tauri app. Creates a real Pi SDK
// session (excludeTools: ["bash"]) and exposes WorkerAPI to the frontend
// over kkrpc stdio transport.
//
// Phase 0 scope: streaming chat only. No system prompt assembly, no
// permission layer, no scheduler — those arrive in Phase 1/2.

import { createAgentSession } from "@earendil-works/pi-coding-agent";
import { RPCChannel } from "kkrpc";
import { nodeStdioTransport } from "kkrpc/stdio";

import type { FrontendAPI, WorkerAPI } from "../shared/api";
import { createWorkerCore, type PiSessionLike } from "./worker-core";

async function main(): Promise<void> {
  const cwd = process.env.AB_DIR ?? process.cwd();

  const { session } = await createAgentSession({
    cwd,
    excludeTools: ["bash"], // file-only tool set (NFR-SEC-01)
  });

  // Channel first so the frontend proxy exists before events flow.
  let core: ReturnType<typeof createWorkerCore> | undefined;

  const transport = nodeStdioTransport();
  const channel = new RPCChannel<WorkerAPI, FrontendAPI>(transport, {
    expose: {
      async prompt(text: string) {
        await core?.api.prompt(text);
      },
      async abort() {
        await core?.api.abort();
      },
      async getState() {
        if (!core) throw new Error("worker not ready");
        return core.api.getState();
      },
      async shutdown() {
        await core?.api.shutdown();
        core?.dispose();
      },
    },
  });

  const frontend = channel.getAPI();
  core = createWorkerCore(session as unknown as PiSessionLike, frontend);
}

main().catch((err) => {
  // Worker crash surfaces as a process exit; tauri-plugin-js onExit notifies
  // the frontend, which shows a friendly error + restart option (NFR-REL-05).
  console.error("[agent-worker] fatal:", err);
  process.exit(1);
});
