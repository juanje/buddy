<script lang="ts">
  import type { ChatMessage } from "./chat-controller";
  import { renderMarkdown } from "./markdown";
  import { t } from "./i18n";

  let { message }: { message: ChatMessage } = $props();

  let thinkingExpanded = $state(false);

  const html = $derived(message.role === "assistant" ? renderMarkdown(message.text) : "");
  const hasThinking = $derived(Boolean(message.thinking?.trim()));
</script>

<div class="row {message.role}">
  {#if message.role === "assistant"}
    <div class="bubble assistant prose">
      {#if hasThinking}
        <button
          type="button"
          class="thinking-toggle"
          onclick={() => (thinkingExpanded = !thinkingExpanded)}
          aria-expanded={thinkingExpanded}
        >
          {thinkingExpanded ? $t.thinkingHide : $t.thinkingShow}
        </button>
        {#if thinkingExpanded}
          <div class="thinking">{message.thinking}</div>
        {/if}
      {/if}
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
  .thinking-toggle {
    display: block;
    border: none;
    background: transparent;
    color: var(--muted);
    font-size: 11px;
    cursor: pointer;
    padding: 0 0 6px;
    margin-bottom: 4px;
  }
  .thinking-toggle:hover {
    color: var(--fg);
  }
  .thinking {
    font-size: 12px;
    color: var(--muted);
    white-space: pre-wrap;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
    line-height: 1.45;
  }
</style>
