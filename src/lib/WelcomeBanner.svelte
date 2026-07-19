<script lang="ts">
  import type { DeferredItemView } from "../../shared/api";
  import { t } from "./i18n";

  let {
    deferredItems,
    visible,
    onDismiss,
  }: {
    deferredItems: DeferredItemView[];
    visible: boolean;
    onDismiss?: () => void;
  } = $props();

  const hasDeferred = $derived(deferredItems.length > 0);
</script>

{#if visible}
  <div class="welcome" role="region" aria-label={$t.welcomeRegion}>
    {#if hasDeferred}
      <div class="card deferred">
        <p class="heading">
          {$t.welcomeDeferredHeading.replace("{count}", String(deferredItems.length))}
        </p>
        <ul>
          {#each deferredItems as item (item.dueDate + item.text)}
            <li>
              <span class="type">[{item.type}]</span>
              {#if item.overdue}
                <span class="badge overdue">{$t.welcomeOverdue}</span>
              {:else}
                <span class="badge due">{$t.welcomeDueToday}</span>
              {/if}
              {item.text}
            </li>
          {/each}
        </ul>
      </div>
    {:else}
      <p class="greeting">{$t.welcomeGreeting}</p>
    {/if}
    {#if onDismiss}
      <button type="button" class="dismiss" onclick={onDismiss} aria-label={$t.welcomeDismiss}>
        ×
      </button>
    {/if}
  </div>
{/if}

<style>
  .welcome {
    position: relative;
    padding: 16px 12px 8px;
  }
  .greeting {
    margin: 0;
    text-align: center;
    color: var(--muted);
    font-size: 14px;
  }
  .card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 12px 14px;
    max-width: 90%;
    margin: 0 auto;
  }
  .heading {
    margin: 0 0 8px;
    font-size: 13px;
    color: var(--fg);
    font-weight: 500;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    font-size: 13px;
    color: var(--fg-secondary, var(--fg));
    padding: 4px 0;
    line-height: 1.4;
  }
  .type {
    color: var(--muted);
    font-size: 11px;
    margin-right: 4px;
  }
  .badge {
    display: inline-block;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    padding: 1px 5px;
    border-radius: 4px;
    margin-right: 6px;
  }
  .badge.due {
    background: color-mix(in srgb, var(--accent) 20%, transparent);
    color: var(--accent);
  }
  .badge.overdue {
    background: color-mix(in srgb, var(--error-fg, #c44) 15%, transparent);
    color: var(--error-fg, #c44);
  }
  .dismiss {
    position: absolute;
    top: 12px;
    right: 16px;
    border: none;
    background: transparent;
    color: var(--muted);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    padding: 2px 6px;
  }
  .dismiss:hover {
    color: var(--fg);
  }
</style>
