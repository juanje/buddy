<script lang="ts">
  import type { ChatMessage } from "./chat-controller";
  import { toolActivitySummary, toolCallLabel } from "./tool-labels";
  import { t } from "./i18n";

  let { message, streaming = false }: { message: ChatMessage; streaming?: boolean } = $props();

  let expanded = $state(false);

  const calls = $derived(message.toolCalls ?? []);
  const summary = $derived(toolActivitySummary(calls, $t));
  const running = $derived(calls.some((c) => c.status === "running"));
  const hidden = $derived(!streaming && !running);
</script>

{#if !hidden}
<div class="tool-activity">
  <button
    type="button"
    class="summary"
    class:running
    onclick={() => (expanded = !expanded)}
    aria-expanded={expanded}
  >
    <span class="icon">{running ? "◌" : "✓"}</span>
    <span>{summary}</span>
    {#if calls.length > 1}
      <span class="chevron">{expanded ? "▾" : "▸"}</span>
    {/if}
  </button>
  {#if expanded && calls.length > 0}
    <ul class="details">
      {#each calls as call (call.name + (call.path ?? "") + call.status)}
        <li class:done={call.status === "done"}>
          {toolCallLabel(call, $t)}
        </li>
      {/each}
    </ul>
  {/if}
</div>
{/if}

<style>
  .tool-activity {
    padding: 2px 12px 4px;
  }
  .summary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: none;
    background: transparent;
    color: var(--muted);
    font-size: 12px;
    cursor: pointer;
    padding: 4px 0;
  }
  .summary.running {
    color: var(--fg-secondary);
  }
  .summary:hover {
    color: var(--fg);
  }
  .icon {
    font-size: 10px;
    opacity: 0.8;
  }
  .chevron {
    font-size: 10px;
    opacity: 0.7;
  }
  .details {
    list-style: none;
    margin: 4px 0 0 16px;
    padding: 0;
    font-size: 11px;
    color: var(--muted);
  }
  .details li {
    padding: 2px 0;
  }
  .details li.done {
    opacity: 0.85;
  }
</style>
