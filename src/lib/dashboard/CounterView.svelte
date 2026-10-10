<script lang="ts">
  import type { CounterGroupVm } from "./view-model";

  let {
    value,
    delta,
    groups,
  }: {
    value?: number;
    delta?: number;
    groups?: CounterGroupVm[];
  } = $props();
</script>

{#if groups && groups.length > 0}
  <ul class="grouped">
    {#each groups as group (group.label)}
      <li>
        <span class="label">{group.label}</span>
        <span class="counter">{group.value}</span>
      </li>
    {/each}
  </ul>
{:else}
  <p class="counter">{value ?? 0}</p>
  {#if delta !== undefined}
    <p class="delta" class:positive={delta > 0} class:negative={delta < 0}>
      {delta > 0 ? "+" : ""}{delta}
    </p>
  {/if}
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
  .grouped {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .grouped li {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 14px;
  }
  .label {
    color: var(--muted);
  }
  .grouped .counter {
    font-size: 20px;
  }
</style>
