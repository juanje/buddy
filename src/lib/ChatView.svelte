<script lang="ts">
  import type { ChatController } from "./chat-controller";
  import MessageBubble from "./MessageBubble.svelte";

  let { controller }: { controller: ChatController } = $props();

  const { messages, typingIndicator } = controller;
</script>

<div class="chat">
  {#each $messages as message (message.id)}
    <MessageBubble {message} />
  {/each}
  {#if $typingIndicator}
    <div class="typing" aria-label="assistant is typing">
      <span></span><span></span><span></span>
    </div>
  {/if}
</div>

<style>
  .chat {
    flex: 1;
    overflow-y: auto;
    padding: 12px 0;
    display: flex;
    flex-direction: column;
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
