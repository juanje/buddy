<script lang="ts">
  import type { ChatController } from "./chat-controller";
  import type { ScrollController } from "./scroll-controller";
  import MessageBubble from "./MessageBubble.svelte";
  import { t } from "./i18n";

  let { controller, scroll }: { controller: ChatController; scroll: ScrollController } =
    $props();

  let container: HTMLDivElement | undefined = $state();

  export function scrollToLatest() {
    if (container) container.scrollTop = container.scrollHeight - container.clientHeight;
  }

  // Content growth → let the scroll controller decide whether to follow.
  $effect(() => {
    $controller.messages;
    $controller.typingIndicator;
    scroll.notifyContentGrown();
  });

  function handleScroll() {
    if (!container) return;
    const NEAR_BOTTOM_PX = 4;
    const atBottom =
      container.scrollTop + container.clientHeight >= container.scrollHeight - NEAR_BOTTOM_PX;
    scroll.onUserScrolled(atBottom);
  }
</script>

<div class="chat-wrap">
  <div class="chat" bind:this={container} onscroll={handleScroll}>
    {#each $controller.messages as message (message.id)}
      <MessageBubble {message} />
    {/each}
    {#if $controller.typingIndicator}
      <div class="typing" aria-label="assistant is typing">
        <span></span><span></span><span></span>
      </div>
    {/if}
  </div>
  {#if $scroll.showScrollButton}
    <button class="scroll-down" onclick={() => scroll.scrollToBottomClicked()} title={t.scrollToBottom}>
      ↓
    </button>
  {/if}
</div>

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
