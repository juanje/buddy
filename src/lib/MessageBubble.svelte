<script lang="ts">
  import type { ChatMessage } from "./chat-controller";
  import { renderMarkdown } from "./markdown";

  let { message }: { message: ChatMessage; streaming?: boolean } = $props();

  const html = $derived(message.role === "assistant" ? renderMarkdown(message.text) : "");
</script>

<div class="row {message.role}">
  {#if message.role === "assistant"}
    <div class="bubble assistant prose">
      {#if message.text}
        {@html html}
      {/if}
    </div>
  {:else}
    <div class="bubble user">{message.text}</div>
  {/if}
</div>

<style>
  .row {
    display: flex;
    padding: 4px 12px;
  }
  .row.user {
    justify-content: flex-end;
  }
  .row.assistant {
    justify-content: flex-start;
  }
  .bubble {
    max-width: 75%;
    padding: 10px 14px;
    border-radius: 14px;
    word-break: break-word;
  }
  .bubble.user {
    background: var(--bubble-user);
    color: var(--bubble-user-fg);
    border-bottom-right-radius: 4px;
    white-space: pre-wrap;
  }
  .bubble.assistant {
    background: var(--bubble-assistant);
    color: var(--bubble-assistant-fg);
    border-bottom-left-radius: 4px;
  }
</style>
