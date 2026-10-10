<script lang="ts">
  import type { TableHeaderVm } from "./view-model";

  let {
    headers,
    rows,
    emptyLabel,
  }: { headers: TableHeaderVm[]; rows: Record<string, string>[]; emptyLabel: string } = $props();
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
        {#each rows as row, i (i)}
          <tr>
            {#each headers as col (col.key)}
              <td>{row[col.key] ?? ""}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
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
</style>
