<script lang="ts">
  import type { CalendarChartModel } from "../../../shared/dashboard/views-v2-model";

  let {
    chart,
    emptyLabel,
  }: {
    chart: CalendarChartModel;
    emptyLabel: string;
  } = $props();

  const cell = 14;
  const gap = 3;
</script>

{#if chart.cells.length === 0}
  <p class="empty">{emptyLabel}</p>
{:else}
  <div class="grid" style="--cell: {cell}px; --gap: {gap}px">
    {#each chart.cells as cellData (cellData.date)}
      <span
        class="day"
        title="{cellData.date}: {cellData.value}"
        style="opacity: {0.15 + cellData.intensity * 0.85}"
      ></span>
    {/each}
  </div>
{/if}

<style>
  .grid {
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap);
  }
  .day {
    width: var(--cell);
    height: var(--cell);
    border-radius: 3px;
    background: var(--accent);
  }
  .empty {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }
</style>
