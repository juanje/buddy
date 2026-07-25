<script lang="ts">
  import type { ChatMessage } from "./chat-controller";
  import { renderMarkdown } from "./markdown";
  import { t } from "./i18n";

  let { message, streaming = false }: { message: ChatMessage; streaming?: boolean } = $props();

  const html = $derived(message.role === "assistant" ? renderMarkdown(message.text) : "");
  const hasThinking = $derived(Boolean(message.thinking?.trim()));
  const thinkingOnlyBubble = $derived(hasThinking && !message.text);
  const hidden = $derived(thinkingOnlyBubble && !streaming);
</script>

{#if !hidden}
<div class="row {message.role}">
  {#if message.role === "assistant"}
    <div class="bubble assistant prose">
      {#if thinkingOnlyBubble && streaming}
        <span class="thinking-indicator">{$t.thinkingShow}</span>
      {/if}
      {#if message.text}
        {@html html}
      {/if}
    </div>
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
  .thinking-indicator {
    display: block;
    color: var(--muted);
    font-size: 11px;
  }
</style>
