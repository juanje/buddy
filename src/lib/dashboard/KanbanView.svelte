<script lang="ts">
  import type { KanbanColumnVm } from "./view-model";
  import { getLocale } from "../i18n";
  import { overdueLabel } from "./view-model";

  let { columns, emptyLabel }: { columns: KanbanColumnVm[]; emptyLabel: string } = $props();
  const locale = $derived(getLocale());
</script>

{#if columns.every((c) => c.cards.length === 0)}
  <p class="empty">{emptyLabel}</p>
{:else}
  <div class="kanban">
    {#each columns as col (col.label)}
      <section class="column">
        <h4>{col.label}</h4>
        <ul>
          {#each col.cards as card, i (i)}
            <li class:overdue={card.overdueDays !== undefined}>
              <span class="card-text">{card.text}</span>
              {#if card.overdueDays !== undefined}
                <span class="overdue-tag">{overdueLabel(card.overdueDays, locale)}</span>
              {/if}
              {#if card.chips.length > 0}
                <span class="chips">
                  {#each card.chips as chip (chip)}
                    <span class="chip">{chip}</span>
                  {/each}
                </span>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
{/if}

<style>
  .kanban {
    display: flex;
    gap: 12px;
    overflow-x: auto;
  }
  .column {
    flex: 1;
    min-width: 140px;
    display: flex;
    flex-direction: column;
    max-height: 320px;
  }
  h4 {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--muted);
    flex-shrink: 0;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
    min-height: 0;
    flex: 1;
  }
  li {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 10px;
    background: var(--bg);
    font-size: 13px;
  }
  li.overdue {
    border-left: 3px solid var(--error-fg);
  }
  .overdue-tag {
    display: block;
    margin-top: 4px;
    font-size: 11px;
    color: var(--error-fg);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;
  }
  .chip {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 999px;
    background: var(--bg-secondary);
  }
  .empty {
    color: var(--muted);
    font-size: 13px;
    margin: 0;
  }
</style>
