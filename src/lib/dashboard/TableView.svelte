<script lang="ts">
  let {
    columns,
    rows,
    emptyLabel,
  }: { columns: string[]; rows: Record<string, string>[]; emptyLabel: string } = $props();
</script>

{#if rows.length === 0}
  <p class="empty">{emptyLabel}</p>
{:else}
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          {#each columns as col (col)}
            <th>{col}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each rows as row, i (i)}
          <tr>
            {#each columns as col (col)}
              <td>{row[col] ?? ""}</td>
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
