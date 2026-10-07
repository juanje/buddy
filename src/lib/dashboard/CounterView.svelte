<script lang="ts">
  let {
    value,
    delta,
  }: {
    value: number;
    delta?: number;
  } = $props();
</script>

<p class="counter">{value}</p>
{#if delta !== undefined}
  <p class="delta" class:positive={delta > 0} class:negative={delta < 0}>
    {delta > 0 ? "+" : ""}{delta}
  </p>
{/if}

<style>
  .counter {
    font-size: 32px;
    font-weight: 600;
    margin: 0;
    line-height: 1.1;
  }
  .delta {
    margin: 4px 0 0;
    font-size: 14px;
    color: var(--muted);
  }
  .delta.positive {
    color: var(--success);
  }
  .delta.negative {
    color: var(--error-fg);
  }
</style>
