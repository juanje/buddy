<script lang="ts">
  // App shell. Chat UI built out feature by feature:
  // FR-CHAT-02 input/send · FR-CHAT-01 streaming · FR-CHAT-03 abort ·
  // FR-CHAT-07 auto-scroll · FR-SETUP-01 first-run wizard routing.
  import { onMount } from "svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { getCurrentWebview } from "@tauri-apps/api/webview";
  import { open } from "@tauri-apps/plugin-shell";
  import { createChatController, type ChatController } from "./lib/chat-controller";
  import { createScrollController } from "./lib/scroll-controller";
  import { get } from "svelte/store";
  import { connectWorker, type WorkerConnection } from "./utils/agent";
  import { createWorkerProxy } from "./utils/worker-proxy";
  import { devLog, onDevCommand } from "./utils/dev-log";
  import { resolveInitialView, applyLocaleFromSetup, type AppView } from "./lib/app-view";
  import ChatView from "./lib/ChatView.svelte";
  import InputBar from "./lib/InputBar.svelte";
  import SetupWizard from "./lib/SetupWizard.svelte";
  import { t } from "./lib/i18n";
  import type { AgentEvent, DeferredItemView, OAuthUIEvent, SetupConfig } from "../shared/api";

  const APP_VERSION = "0.1.0";

  let connection: WorkerConnection | undefined = $state();
  let connectionError: string | undefined = $state();
  let controller: ChatController | undefined = $state();
  // undefined until the worker reports setup state (brief blank on launch).
  let view: AppView | undefined = $state();
  let dragOver = $state(false);
  let deferredItems: DeferredItemView[] = $state([]);
  let setupOAuthHandler: ((event: OAuthUIEvent) => void) | undefined = $state();
  let abDirectory = $state("");
  let configuredModel = $state("");
  let aboutOpen = $state(false);
  let aboutModel = $state("—");
  let aboutTurns = $state(0);

  // The controller is created before the worker connects so the UI renders
  // immediately; prompts are proxied to whatever connection exists.
  const workerProxy = createWorkerProxy(() => connection);

  controller = createChatController(workerProxy);

  let chatView: ChatView | undefined = $state();
  const scroll = createScrollController(() => chatView?.scrollToLatest());

  async function handleOAuthEvent(event: OAuthUIEvent): Promise<void> {
    if (event.type === "auth_url" && event.url) {
      try {
        await open(event.url);
      } catch {
        // Browser dev without Tauri shell — URL still visible in wizard state.
      }
    }
    setupOAuthHandler?.(event);
  }

  function registerSetupOAuth(handler: (event: OAuthUIEvent) => void): () => void {
    setupOAuthHandler = handler;
    return () => {
      if (setupOAuthHandler === handler) setupOAuthHandler = undefined;
    };
  }

  async function endSession(): Promise<void> {
    try {
      if (connection) {
        await Promise.race([
          connection.api.shutdown(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("shutdown timeout")), 2000),
          ),
        ]);
      }
    } catch {
      // Best-effort shutdown; allow close anyway.
    }
    try {
      await getCurrentWindow().destroy();
    } catch {
      // Browser dev without Tauri window API.
    }
  }

  function applySetupConfig(config: SetupConfig): void {
    abDirectory = config.abDirectory;
    configuredModel = config.model;
  }

  async function refreshAboutInfo(): Promise<void> {
    aboutModel = configuredModel || "—";
    aboutTurns = 0;
    if (!connection) return;
    try {
      const state = await connection.api.getState();
      aboutTurns = state.messageCount;
      if (state.model) aboutModel = state.model;
    } catch {
      // Worker not ready — keep config fallback.
    }
  }

  async function toggleAbout(): Promise<void> {
    if (!aboutOpen) {
      await refreshAboutInfo();
    }
    aboutOpen = !aboutOpen;
  }

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
          onPermissionRequest(request) {
            devLog(`permission request: ${request.op} ${request.path}`);
            controller?.handlePermissionRequest(request);
          },
          onOAuthEvent(event) {
            void handleOAuthEvent(event);
          },
        },
        (code) => {
          connectionError = `Worker exited (code ${code ?? "unknown"})`;
          devLog(`worker exited, code ${code ?? "unknown"}`);
        },
      );
      devLog("connect(): worker connected");
      const setupState = await connection.api.getSetupState();
      applyLocaleFromSetup(setupState);
      view = resolveInitialView(setupState);
      if (!setupState.firstRun) {
        applySetupConfig(setupState.config);
      }
      if (view === "chat") {
        deferredItems = await connection.api.getDeferredItems();
      }
      devLog(`view: ${view}`);
    } catch (err) {
      connectionError = err instanceof Error ? err.message : String(err);
      devLog(`connect() failed: ${connectionError}`);
    }
  }

  onMount(() => {
    void connect();

    let unlistenClose: (() => void) | undefined;
    let unlistenDrag: (() => void) | undefined;
    void (async () => {
      const win = getCurrentWindow();
      unlistenClose = await win.onCloseRequested(async (event) => {
        event.preventDefault();
        await endSession();
      });

      try {
        const webview = getCurrentWebview();
        unlistenDrag = await webview.onDragDropEvent((event) => {
          if (view !== "chat" || !controller) return;
          if (event.payload.type === "enter" || event.payload.type === "over") {
            dragOver = true;
          } else if (event.payload.type === "drop") {
            dragOver = false;
            controller.addAttachments(event.payload.paths);
          } else {
            dragOver = false;
          }
        });
      } catch {
        // Drag-drop requires Tauri webview — skip in browser dev.
      }
    })();

    return () => {
      unlistenClose?.();
      unlistenDrag?.();
    };
  });

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
          view,
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
      <span>{$t.connectionLost}: {connectionError}</span>
      <button onclick={connect}>{$t.restart}</button>
    </div>
  {/if}
  {#if view === "setup"}
    <SetupWizard
      worker={workerProxy}
      onRegisterOAuth={registerSetupOAuth}
      onComplete={async () => {
        view = "chat";
        const setupState = await workerProxy.getSetupState();
        if (!setupState.firstRun) {
          applySetupConfig(setupState.config);
        }
        deferredItems = await workerProxy.getDeferredItems();
      }}
      onSetupFailed={() => (view = "setup")}
    />
  {:else if view === "chat" && controller}
    <div class="chat-shell" class:drag-over={dragOver}>
      {#if dragOver}
        <div class="drop-overlay">{$t.dropOverlay}</div>
      {/if}
      <ChatView bind:this={chatView} {controller} {scroll} {deferredItems} />
      <InputBar
        {controller}
        onAbort={() => controller?.abort()}
        onSent={() => scroll.onUserMessageSent()}
      />
    </div>
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
  .chat-shell {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .chat-shell.drag-over {
    outline: 2px dashed var(--accent);
    outline-offset: -4px;
  }
  .drop-overlay {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.35);
    color: #fff;
    font-size: 18px;
    font-weight: 500;
    pointer-events: none;
  }
</style>
