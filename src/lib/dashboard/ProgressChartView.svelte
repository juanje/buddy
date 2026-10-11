<script lang="ts">
  import type { ProgressCountdownModel, ProgressDataModel } from "../../../shared/dashboard/views-v2-model";

  let {
    data,
    countdown,
    countdownLabel,
  }: {
    data?: ProgressDataModel;
    countdown?: ProgressCountdownModel;
    countdownLabel: (days: number, until: string) => string;
  } = $props();

  const width = 320;
  const height = 48;
  const barH = 12;
</script>

{#if data}
  <div class="progress-data">
    <div class="values">
      <span class="value">{data.value}</span>
      <span class="max">/ {data.max}</span>
    </div>
    <svg viewBox="0 0 {width} {height}" class="bar-svg" aria-hidden="true">
      <rect x="0" y="20" width={width} height={barH} class="track" rx="4" />
      <rect
        x="0"
        y="20"
        width={Math.max(0, data.fraction * width)}
        height={barH}
        class="fill"
        rx="4"
      />
    </svg>
  </div>
{:else if countdown}
  <p class="countdown">{countdownLabel(countdown.daysRemaining, countdown.until)}</p>
{/if}

<style>
  .progress-data {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .values {
    font-size: 14px;
  }
  .value {
    font-weight: 600;
    font-size: 24px;
  }
  .max {
    color: var(--muted);
  }
  .bar-svg {
    width: 100%;
    max-width: 320px;
    height: auto;
  }
  .track {
    fill: color-mix(in srgb, var(--border) 80%, transparent);
  }
  .fill {
    fill: var(--accent);
  }
  .countdown {
    margin: 0;
    font-size: 14px;
  }
</style>
