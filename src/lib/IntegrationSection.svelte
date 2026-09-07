<script lang="ts">
  import { t } from "./i18n";

  let {
    title,
    active = false,
    open = $bindable(false),
    children,
  }: {
    title: string;
    active?: boolean;
    open?: boolean;
    children?: import("svelte").Snippet;
  } = $props();

  function toggleOpen() {
    open = !open;
  }
</script>

<section class="integration-section">
  <button type="button" class="section-header" onclick={toggleOpen} aria-expanded={open}>
    <span class="section-title">{title}</span>
    <span class="section-meta">
      {#if active}
        <span class="badge active">{$t.settingsIntegrationActive}</span>
      {:else}
        <span class="badge inactive">{$t.settingsIntegrationInactive}</span>
      {/if}
      <span class="chevron" class:open aria-hidden="true">›</span>
    </span>
  </button>

  {#if open}
    <div class="section-body">
      {@render children?.()}
    </div>
  {/if}
</section>

<style>
  .integration-section {
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
  }
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    padding: 12px 14px;
    border: none;
    background: var(--bg-secondary);
    color: var(--fg);
    cursor: pointer;
    text-align: left;
    font: inherit;
  }
  .section-header:hover {
    background: color-mix(in srgb, var(--bg-secondary) 85%, var(--accent) 15%);
  }
  .section-title {
    font-size: 1rem;
    font-weight: 600;
  }
  .section-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  .badge {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 999px;
    font-weight: 500;
  }
  .badge.active {
    background: color-mix(in srgb, var(--success) 18%, transparent);
    color: var(--success);
  }
  .badge.inactive {
    background: color-mix(in srgb, var(--muted) 15%, transparent);
    color: var(--muted);
  }
  .chevron {
    display: inline-block;
    font-size: 18px;
    line-height: 1;
    color: var(--muted);
    transform: rotate(90deg);
    transition: transform 0.15s ease;
  }
  .chevron.open {
    transform: rotate(-90deg);
  }
  .section-body {
    padding: 12px 14px 14px;
    border-top: 1px solid var(--border);
  }
</style>
