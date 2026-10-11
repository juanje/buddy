<script lang="ts">
  import type { LineChartModel } from "../../../shared/dashboard/views-v2-model";

  let {
    chart,
    emptyLabel,
  }: {
    chart: LineChartModel;
    emptyLabel: string;
  } = $props();

  const width = 400;
  const height = 160;
  const pad = { l: 32, r: 12, t: 12, b: 28 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;

  const xs = $derived([...new Set(chart.points.map((p) => p.x))].sort());
  const maxY = $derived(Math.max(1, ...chart.points.map((p) => p.y)));

  function xPos(x: string): number {
    const idx = xs.indexOf(x);
    if (xs.length <= 1) return pad.l + innerW / 2;
    return pad.l + (idx / (xs.length - 1)) * innerW;
  }

  function yPos(y: number): number {
    return pad.t + innerH - (y / maxY) * innerH;
  }

  function polylineFor(series?: string): string {
    const pts = chart.points.filter((p) => (series === undefined ? !p.series : p.series === series));
    return pts.map((p) => `${xPos(p.x)},${yPos(p.y)}`).join(" ");
  }
</script>

{#if chart.points.length === 0}
  <p class="empty">{emptyLabel}</p>
{:else}
  <svg class="chart" viewBox="0 0 {width} {height}" role="img" aria-hidden="true">
    {#if chart.seriesNames.length === 0}
      <polyline points={polylineFor()} class="line" fill="none" />
      {#each chart.points as pt (pt.x + pt.y)}
        <circle cx={xPos(pt.x)} cy={yPos(pt.y)} r="3" class="dot" />
      {/each}
    {:else}
      {#each chart.seriesNames as name (name)}
        <polyline points={polylineFor(name)} class="line" fill="none" />
      {/each}
    {/if}
  </svg>
{/if}

<style>
  .chart {
    width: 100%;
    max-width: 480px;
    height: auto;
  }
  .line {
    stroke: var(--accent);
    stroke-width: 2;
  }
  .dot {
    fill: var(--accent);
  }
  .empty {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }
</style>
