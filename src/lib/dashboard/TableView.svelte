<script lang="ts">
  import type { AppLocale } from "../i18n";
  import type { TableHeaderVm } from "./view-model";
  import { TABLE_PAGE_SIZE, tablePageMeta, tablePageSlice } from "./view-model";

  let {
    headers,
    rows,
    emptyLabel,
    showMoreLabel,
    locale = "en",
  }: {
    headers: TableHeaderVm[];
    rows: Record<string, string>[];
    emptyLabel: string;
    showMoreLabel: string;
    locale?: AppLocale;
  } = $props();

  let shown = $state(TABLE_PAGE_SIZE);

  $effect(() => {
    rows;
    shown = TABLE_PAGE_SIZE;
  });

  const visibleRows = $derived(tablePageSlice(rows, shown));
  const page = $derived(tablePageMeta(shown, rows.length, locale));
  const showMoreText = $derived(showMoreLabel.replace("{count}", String(page.nextCount)));

  function showMore() {
    shown = Math.min(rows.length, shown + TABLE_PAGE_SIZE);
  }
</script>

{#if rows.length === 0}
  <p class="empty">{emptyLabel}</p>
{:else}
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          {#each headers as col (col.key)}
            <th>{col.label}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each visibleRows as row, i (i)}
          <tr>
            {#each headers as col (col.key)}
              <td>{row[col.key] ?? ""}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {#if page.hasMore}
    <p class="table-footer">
      <span>{page.footerText}</span>
      <button type="button" class="table-more" onclick={showMore}>{showMoreText}</button>
    </p>
  {/if}
{/if}

<style>
  .table-wrap {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    table-layout: auto;
  }
  th,
  td {
    text-align: left;
    padding: 6px 8px;
    border-bottom: 1px solid var(--border);
  }
  th {
    font-weight: 600;
    color: var(--muted);
    font-size: 12px;
  }
  .empty {
    color: var(--muted);
    font-size: 13px;
    margin: 0;
  }
  .table-footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: 8px 0 0;
    font-size: 12px;
    color: var(--muted);
  }
  .table-more {
    font: inherit;
    color: var(--accent);
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-decoration: underline;
  }
  .table-more:hover {
    opacity: 0.85;
  }
</style>
