<script lang="ts">
  import type { ChatController } from "./chat-controller";
  import type { ScrollController } from "./scroll-controller";
  import type { DeferredItemView } from "../../shared/api";
  import MessageBubble from "./MessageBubble.svelte";
  import PermissionCard from "./PermissionCard.svelte";
  import ToolActivity from "./ToolActivity.svelte";
  import WelcomeBanner from "./WelcomeBanner.svelte";
  import FileViewer from "./FileViewer.svelte";
  import { openPath } from "@tauri-apps/plugin-opener";
  import { routeLocalLinkClick } from "./local-link-handler";
  import type { FileViewerController } from "./file-viewer-controller";
  import { t } from "./i18n";

  let {
    controller,
    scroll,
    deferredItems = [],
    rootDir = "",
    fileViewer,
  }: {
    controller: ChatController;
    scroll: ScrollController;
    deferredItems?: DeferredItemView[];
    rootDir?: string;
    fileViewer?: FileViewerController;
  } = $props();

  // $derived (not plain destructuring) so the stores track prop reassignment;
  // `$controller.messages` is invalid — the controller itself is not a store.
  const messages = $derived(controller.messages);
  const typingIndicator = $derived(controller.typingIndicator);
  const streamingBubbleId = $derived(controller.streamingBubbleId);
  const permissions = $derived(controller.permissions);
  const welcomeVisible = $derived(controller.welcomeVisible);
  const showScrollButton = $derived(scroll.showScrollButton);

  let container: HTMLDivElement | undefined = $state();

  export function scrollToLatest() {
    if (container) container.scrollTop = container.scrollHeight - container.clientHeight;
  }

  // Content growth → let the scroll controller decide whether to follow.
  $effect(() => {
    $messages;
    $typingIndicator;
    scroll.notifyContentGrown();
  });

  function handleScroll() {
    if (!container) return;
    const NEAR_BOTTOM_PX = 4;
    const atBottom =
      container.scrollTop + container.clientHeight >= container.scrollHeight - NEAR_BOTTOM_PX;
    scroll.onUserScrolled(atBottom);
  }

  async function handleChatClick(event: MouseEvent) {
    if (!rootDir) return;
    const anchor = (event.target as HTMLElement).closest("a[data-local-path]");
    if (!anchor) return;
    event.preventDefault();
    const rel = anchor.getAttribute("data-local-path");
    if (!rel) return;
    const action = routeLocalLinkClick(rootDir, rel);
    if (!action) return;

    if (action.type === "view") {
      if (!fileViewer) {
        console.error("[local-link] file viewer unavailable");
        return;
      }
      await fileViewer.openFile(action.absPath);
      return;
    }

    try {
      await openPath(action.absPath);
    } catch (err) {
      console.error("[local-link] openPath failed:", action.absPath, err);
    }
  }
</script>

<div class="chat-wrap">
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="chat" bind:this={container} onscroll={handleScroll} onclick={handleChatClick}>
    <WelcomeBanner
      {deferredItems}
      visible={$welcomeVisible}
      onDismiss={() => controller.dismissWelcome()}
    />
    {#each $messages as message (message.id)}
      {#if message.role === "tool-activity"}
        <ToolActivity {message} streaming={$typingIndicator} />
      {:else}
        <MessageBubble {message} streaming={message.id === $streamingBubbleId} />
      {/if}
    {/each}
    {#each $permissions as card (card.request.id)}
      <PermissionCard
        {card}
        onRespond={(id, allow, persist) => controller.respondPermission(id, allow, persist)}
        onDismiss={(id) => controller.dismissPermission(id)}
      />
    {/each}
    {#if $typingIndicator}
      <div class="typing" aria-label={$t.typingIndicatorLabel}>
        <span></span><span></span><span></span>
      </div>
    {/if}
  </div>
  {#if $showScrollButton}
    <button class="scroll-down" onclick={() => scroll.scrollToBottomClicked()} title={$t.scrollToBottom}>
      ↓
    </button>
  {/if}
</div>
{#if fileViewer}
  <FileViewer controller={fileViewer} />
{/if}

<style>
  .chat-wrap {
    position: relative;
    flex: 1;
    display: flex;
    min-height: 0;
  }
  .chat {
    flex: 1;
    overflow-y: auto;
    padding: 12px 0;
    display: flex;
    flex-direction: column;
  }
  .scroll-down {
    position: absolute;
    bottom: 16px;
    right: 20px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--fg);
    font-size: 16px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }
  .typing {
    display: flex;
    gap: 4px;
    padding: 10px 16px;
  }
  .typing span {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--muted);
    animation: pulse 1.2s infinite ease-in-out;
  }
  .typing span:nth-child(2) {
    animation-delay: 0.2s;
  }
  .typing span:nth-child(3) {
    animation-delay: 0.4s;
  }
  @keyframes pulse {
    0%,
    80%,
    100% {
      opacity: 0.3;
    }
    40% {
      opacity: 1;
    }
  }
</style>
