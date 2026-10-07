<script lang="ts">
  import type { StatusCardVm } from "./view-model";

  let { cards, emptyLabel }: { cards: StatusCardVm[]; emptyLabel: string } = $props();
</script>

{#if cards.length === 0}
  <p class="empty">{emptyLabel}</p>
{:else}
  <div class="status-grid">
    {#each cards as card (card.label)}
      <article class="status-card tone-{card.state}">
        <p class="label">{card.label}</p>
        <p class="reason">{card.reason}</p>
      </article>
    {/each}
  </div>
{/if}

<style>
  .status-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .status-card {
    border-radius: 10px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-left-width: 4px;
  }
  .tone-ok {
    border-left-color: #2e7d32;
  }
  .tone-warn {
    border-left-color: #ed6c02;
  }
  .tone-bad {
    border-left-color: var(--error-fg);
  }
  .tone-unknown {
    border-left-color: var(--muted);
  }
  .label {
    margin: 0 0 4px;
    font-weight: 600;
    font-size: 14px;
  }
  .reason {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }
  .empty {
    color: var(--muted);
    font-size: 13px;
    margin: 0;
  }
</style>
