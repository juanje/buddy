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

/**
 * Align global fetch and undici dispatcher on Pi's own undici copy, exactly
 * like the pi CLI does at startup (cli.ts → configureHttpDispatcher()).
 *
 * Without this, on Node >= 26 the builtin fetch consumes compressed API
 * responses through npm undici's dispatcher WITHOUT decompressing them, so the
 * SSE parser sees gzip bytes and every assistant reply arrives empty (0 tokens,
 * no message_update events). Pi only applies the fix in its CLI/RPC entry
 * points; the SDK neither calls nor exports it, so embedders must do it.
 *
 * The exports map of pi-coding-agent doesn't expose the module, hence the
 * file-path import into dist/. If a future Pi version moves the file, we log
 * and continue (a fixed SDK would make this unnecessary).
 */
async function alignHttpDispatcherWithPi(): Promise<void> {
  try {
    const entryUrl = import.meta.resolve("@earendil-works/pi-coding-agent");
    const dispatcherUrl = entryUrl.replace(/dist\/index\.js$/, "dist/core/http-dispatcher.js");
    const { configureHttpDispatcher } = await import(dispatcherUrl);
    configureHttpDispatcher();
  } catch (err) {
    console.error("[agent-worker] could not configure Pi http dispatcher:", err);
  }
}

async function main(): Promise<void> {
  await alignHttpDispatcherWithPi();
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
