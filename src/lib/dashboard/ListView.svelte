<script lang="ts">
  import type { ListItemVm } from "./view-model";
  import { getLocale } from "../i18n";
  import { overdueLabel } from "./view-model";

  let { items, emptyLabel }: { items: ListItemVm[]; emptyLabel: string } = $props();
  const locale = $derived(getLocale());
</script>

{#if items.length === 0}
  <p class="empty">{emptyLabel}</p>
{:else}
  <ul class="list">
    {#each items as item (item.primary)}
      <li class:overdue={item.overdueDays !== undefined}>
        <span class="primary">{item.primary}</span>
        {#if item.overdueDays !== undefined}
          <span class="overdue-tag">{overdueLabel(item.overdueDays, locale)}</span>
        {/if}
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
    border-left: 3px solid transparent;
    padding-left: 6px;
  }
  li.overdue {
    border-left-color: var(--error-fg);
  }
  .primary {
    font-weight: 500;
  }
  .overdue-tag {
    display: block;
    font-size: 11px;
    color: var(--error-fg);
    margin-top: 2px;
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
