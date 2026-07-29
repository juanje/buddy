<script lang="ts">
  import type { ChatMessage } from "./chat-controller";
  import { renderMarkdown } from "./markdown";

  let { message }: { message: ChatMessage; streaming?: boolean } = $props();

  const html = $derived(message.role === "assistant" ? renderMarkdown(message.text) : "");
</script>

<!--
  FR-CHAT-14: an assistant turn with no visible text renders nothing at all.
  The guard used to sit *inside* the bubble, so an empty turn still produced a
  styled, padded, empty box. Local models emit these routinely — reasoning-only
  turns arrive as assistant messages whose content is a bare newline — and they
  accumulated between the thinking indicators and stayed after those cleared.
-->
{#if message.role !== "assistant" || message.text.trim()}
  <div class="row {message.role}">
    {#if message.role === "assistant"}
      <div class="bubble assistant prose">{@html html}</div>
    {:else}
      <div class="bubble user">{message.text}</div>
    {/if}
  </div>
{/if}

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
