<script lang="ts">
  import type { ChatController } from "./chat-controller";
  import MessageBubble from "./MessageBubble.svelte";

  let { controller }: { controller: ChatController } = $props();

  const { messages } = controller;
</script>

<div class="chat">
  {#each $messages as message (message.id)}
    <MessageBubble {message} />
  {/each}
</div>

<style>
  .chat {
    flex: 1;
    overflow-y: auto;
    padding: 12px 0;
    display: flex;
    flex-direction: column;
  }
</style>
