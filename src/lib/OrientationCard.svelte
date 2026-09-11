<script lang="ts">
  import type { OrientationData } from "../../shared/api";
  import { t } from "./i18n";

  let {
    data,
    onDismiss,
  }: {
    data: OrientationData;
    onDismiss?: () => void;
  } = $props();

  function localizedType(raw: string): string {
    const map = $t.deferredTypes as Record<string, string> | undefined;
    return map?.[raw] ?? raw;
  }
</script>

<div class="orientation-card" role="region" aria-label={$t.orientationNotifications}>
  <div class="card">
    <button type="button" class="close-btn" onclick={() => onDismiss?.()} aria-label={$t.orientationDismiss}>
      ×
    </button>

    {#if data.deferred.length > 0}
      <p class="section-heading">{$t.orientationNotifications}</p>
      <ul class="deferred-list">
        {#each data.deferred as item (item.dueDate + item.text)}
          <li>
            <span class="type">{localizedType(item.type)}</span>
            {#if item.overdue}
              <span class="badge overdue">{$t.welcomeOverdue}</span>
            {:else}
              <span class="badge due">{$t.welcomeDueToday}</span>
            {/if}
            {item.text}
          </li>
        {/each}
      </ul>
    {/if}

    <p class="section-heading">{$t.orientationNextTasks}</p>
    {#if data.nextTasks.length > 0}
      <ul class="task-list">
        {#each data.nextTasks as task (task.id)}
          <li>
            {#if task.next}<span class="next-marker">»</span>{/if}
            <span class="task-text">{task.text}</span>
            {#if task.area}<span class="area">@{task.area}</span>{/if}
          </li>
        {/each}
      </ul>
    {:else}
      <p class="empty">{$t.orientationNoTasks}</p>
    {/if}

    {#if onDismiss}
      <div class="dismiss-row">
        <button type="button" class="dismiss-btn" onclick={onDismiss}>
          {$t.orientationDismiss}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .orientation-card {
    padding: 10px 12px 0;
    flex-shrink: 0;
  }
  .card {
    position: relative;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 12px 14px;
    max-width: 90%;
    margin: 0 auto;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    overflow: hidden;
  }
  .close-btn {
    position: absolute;
    top: 8px;
    right: 10px;
    border: none;
    background: transparent;
    color: var(--muted);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    padding: 2px 6px;
  }
  .close-btn:hover {
    color: var(--fg);
  }
  .section-heading {
    margin: 0 0 8px;
    font-size: 13px;
    color: var(--fg);
    font-weight: 600;
  }
  .deferred-list,
  .task-list {
    margin: 0 0 12px;
    padding: 0;
    list-style: none;
    font-size: 13px;
    line-height: 1.4;
  }
  .deferred-list li,
  .task-list li {
    margin-bottom: 6px;
    display: flex;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
  }
  .task-list li {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .task-text {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    min-width: 0;
    flex: 1 1 auto;
  }
  .type {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--muted);
    flex-shrink: 0;
  }
  .badge {
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 4px;
    flex-shrink: 0;
  }
  .badge.due {
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    color: var(--accent);
  }
  .badge.overdue {
    background: color-mix(in srgb, var(--status-error) 15%, transparent);
    color: var(--status-error);
  }
  .next-marker {
    color: var(--accent);
    margin-right: 4px;
    font-weight: 600;
    flex-shrink: 0;
  }
  .area {
    color: var(--muted);
    margin-left: 6px;
    font-size: 11px;
    flex-shrink: 0;
  }
  .empty {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }
  .dismiss-row {
    display: flex;
    justify-content: flex-end;
    margin-top: 10px;
  }
  .dismiss-btn {
    border: 1px solid var(--fg-secondary);
    border-radius: 6px;
    background: transparent;
    color: var(--fg-secondary);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    padding: 4px 14px;
  }
  .dismiss-btn:hover {
    color: var(--fg);
    border-color: var(--fg);
  }
</style>
