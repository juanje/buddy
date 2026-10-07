<script lang="ts">
  import type { ListItemVm } from "./view-model";

  let { items, emptyLabel }: { items: ListItemVm[]; emptyLabel: string } = $props();
</script>

{#if items.length === 0}
  <p class="empty">{emptyLabel}</p>
{:else}
  <ul class="list">
    {#each items as item (item.primary)}
      <li>
        <span class="primary">{item.primary}</span>
        {#if item.fields.length > 0}
          <span class="meta">{item.fields.join(" · ")}</span>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  li {
    font-size: 13px;
  }
  .primary {
    font-weight: 500;
  }
  .meta {
    display: block;
    color: var(--muted);
    font-size: 12px;
    margin-top: 2px;
  }
  .empty {
    color: var(--muted);
    font-size: 13px;
    margin: 0;
  }
</style>
