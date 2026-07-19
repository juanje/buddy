<script lang="ts">
  // App shell (Phase 0). Chat UI built out feature by feature:
  // FR-CHAT-02 input/send · FR-CHAT-01 streaming · FR-CHAT-03 abort ·
  // FR-CHAT-07 auto-scroll.
  import { onMount } from "svelte";
  import { createChatController, type ChatController } from "./lib/chat-controller";
  import { createScrollController } from "./lib/scroll-controller";
  import { get } from "svelte/store";
  import { connectWorker, type WorkerConnection } from "./utils/agent";
  import { devLog, onDevCommand } from "./utils/dev-log";
  import ChatView from "./lib/ChatView.svelte";
  import InputBar from "./lib/InputBar.svelte";
  import { t } from "./lib/i18n";
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

  let chatView: ChatView | undefined = $state();
  const scroll = createScrollController(() => chatView?.scrollToLatest());

  async function connect() {
    connectionError = undefined;
    devLog("connect(): spawning worker…");
    try {
      connection = await connectWorker(
        {
          onAgentEvent(event: AgentEvent) {
            if (event.type !== "message_update") devLog(`event: ${event.type}`);
            controller?.handleEvent(event);
          },
          onWorkerError(error: string) {
            connectionError = error;
            devLog(`onWorkerError: ${error}`);
          },
        },
        (code) => {
          connectionError = `Worker exited (code ${code ?? "unknown"})`;
          devLog(`worker exited, code ${code ?? "unknown"}`);
        },
      );
      devLog("connect(): worker connected");
    } catch (err) {
      connectionError = err instanceof Error ? err.message : String(err);
      devLog(`connect() failed: ${connectionError}`);
    }
  }

  onMount(connect);

  // Dev-only smoke-test bridge: drive the app via POSTs to the Vite server.
  onDevCommand(async (cmd) => {
    if (!controller) return;
    if (cmd.startsWith("prompt ")) {
      controller.input.set(cmd.slice("prompt ".length));
      await controller.send();
    } else if (cmd === "abort") {
      await controller.abort();
    } else if (cmd === "state") {
      devLog(
        `state: ${JSON.stringify({
          streaming: get(controller.streaming),
          connectionError,
          messages: get(controller.messages),
        })}`,
      );
    }
  });

  function handleWindowKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      controller?.onEscape();
    }
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<main>
  {#if connectionError}
    <div class="error-banner">
      <span>{t.connectionLost}: {connectionError}</span>
      <button onclick={connect}>{t.restart}</button>
    </div>
  {/if}
  {#if controller}
    <ChatView bind:this={chatView} {controller} {scroll} />
    <InputBar
      {controller}
      onAbort={() => controller?.abort()}
      onSent={() => scroll.onUserMessageSent()}
    />
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
    background: var(--error-bg);
    color: var(--error-fg);
    font-size: 14px;
  }
  .error-banner button {
    border: 1px solid var(--error-fg);
    background: transparent;
    color: var(--error-fg);
    border-radius: 8px;
    padding: 4px 12px;
    cursor: pointer;
  }
</style>
