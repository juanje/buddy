<script lang="ts">
  import type { TimelineChartModel } from "../../../shared/dashboard/views-v2-model";

  let {
    chart,
    emptyLabel,
  }: {
    chart: TimelineChartModel;
    emptyLabel: string;
  } = $props();
</script>

{#if chart.events.length === 0}
  <p class="empty">{emptyLabel}</p>
{:else}
  <ul class="timeline">
    {#each chart.events as ev (ev.date + ev.label)}
      <li>
        <span class="date">{ev.date}</span>
        <span class="label">{ev.label}</span>
        {#if ev.end}
          <span class="end">→ {ev.end}</span>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .timeline {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 13px;
  }
  .date {
    color: var(--muted);
    margin-right: 8px;
    font-variant-numeric: tabular-nums;
  }
  .end {
    color: var(--muted);
    margin-left: 4px;
  }
  .empty {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }
</style>
