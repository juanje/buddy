<script lang="ts">
  // App shell (Phase 0). Chat UI built out feature by feature:
  // FR-CHAT-02 input/send · FR-CHAT-01 streaming · FR-CHAT-03 abort ·
  // FR-CHAT-07 auto-scroll.
  import { onMount } from "svelte";
  import { createChatController, type ChatController } from "./lib/chat-controller";
  import { connectWorker, type WorkerConnection } from "./utils/agent";
  import ChatView from "./lib/ChatView.svelte";
  import InputBar from "./lib/InputBar.svelte";
  import type { AgentEvent, WorkerAPI } from "../shared/api";

  let connection: WorkerConnection | undefined = $state();
  let connectionError: string | undefined = $state();
  let controller: ChatController | undefined = $state();

  // The controller is created before the worker connects so the UI renders
  // immediately; prompts are proxied to whatever connection exists.
  const workerProxy: WorkerAPI = {
    async prompt(text) {
      await connection?.api.prompt(text);
    },
    async abort() {
      await connection?.api.abort();
    },
    async getState() {
      if (!connection) throw new Error("worker not connected");
      return connection.api.getState();
    },
    async shutdown() {
      await connection?.api.shutdown();
    },
  };

  controller = createChatController(workerProxy);

  async function connect() {
    connectionError = undefined;
    try {
      connection = await connectWorker(
        {
          onAgentEvent(event: AgentEvent) {
            controller?.handleEvent(event);
          },
          onWorkerError(error: string) {
            connectionError = error;
          },
        },
        (code) => {
          connectionError = `Worker exited (code ${code ?? "unknown"})`;
        },
      );
    } catch (err) {
      connectionError = err instanceof Error ? err.message : String(err);
    }
  }

  onMount(connect);
</script>

<main>
  {#if connectionError}
    <div class="error-banner">
      <span>Se perdió la conexión con el asistente: {connectionError}</span>
      <button onclick={connect}>Reiniciar</button>
    </div>
  {/if}
  {#if controller}
    <ChatView {controller} />
    <InputBar {controller} onAbort={() => workerProxy.abort()} />
  {/if}
</main>

<style>
  main {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  .error-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: #7f1d1d;
    color: #fecaca;
    font-size: 14px;
  }
  .error-banner button {
    border: 1px solid #fecaca;
    background: transparent;
    color: #fecaca;
    border-radius: 8px;
    padding: 4px 12px;
    cursor: pointer;
  }
</style>
