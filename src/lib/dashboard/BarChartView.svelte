<script lang="ts">
  import type { BarChartModel } from "../../../shared/dashboard/views-v2-model";

  let {
    chart,
    emptyLabel,
  }: {
    chart: BarChartModel;
    emptyLabel: string;
  } = $props();

  const width = 400;
  const height = 160;
  const pad = { l: 8, r: 8, t: 8, b: 28 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;

  const maxVal = $derived(
    Math.max(chart.threshold ?? 0, ...chart.bars.map((b) => b.total), 1),
  );

  const barWidth = $derived(
    chart.bars.length > 0 ? innerW / chart.bars.length - 8 : innerW,
  );

  function barHeight(total: number): number {
    return (total / maxVal) * innerH;
  }

  function thresholdY(): number | undefined {
    if (chart.threshold === undefined) return undefined;
    return pad.t + innerH - (chart.threshold / maxVal) * innerH;
  }
</script>

{#if chart.bars.length === 0}
  <p class="empty">{emptyLabel}</p>
{:else}
  <svg class="chart" viewBox="0 0 {width} {height}" role="img" aria-hidden="true">
    {#if thresholdY() !== undefined}
      <line
        x1={pad.l}
        y1={thresholdY()}
        x2={width - pad.r}
        y2={thresholdY()}
        class="threshold"
      />
    {/if}
    {#each chart.bars as bar, i (bar.label + i)}
      {@const x = pad.l + i * (innerW / chart.bars.length) + 4}
      {@const h = barHeight(bar.total)}
      {@const y = pad.t + innerH - h}
      <rect {x} {y} width={Math.max(4, barWidth)} height={Math.max(0, h)} class="bar" />
      <text x={x + barWidth / 2} y={height - 6} class="label" text-anchor="middle">
        {bar.label || "—"}
      </text>
    {/each}
  </svg>
{/if}

<style>
  .chart {
    width: 100%;
    max-width: 480px;
    height: auto;
  }
  .bar {
    fill: var(--accent);
  }
  .threshold {
    stroke: var(--muted);
    stroke-dasharray: 4 3;
  }
  .label {
    fill: var(--muted);
    font-size: 10px;
  }
  .empty {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }
</style>
