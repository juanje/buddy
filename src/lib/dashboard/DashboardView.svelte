<script lang="ts">
  import type { ResolvedDashboard, ResolvedSegment } from "../../../shared/dashboard/types";
  import { renderMarkdown } from "../markdown";

  let { model }: { model: ResolvedDashboard } = $props();

  function widgetTitle(seg: Extract<ResolvedSegment, { kind: "widget" }>): string {
    return seg.spec.title ?? seg.spec.view;
  }
</script>

<div class="dashboard">
  {#each model.segments as segment (segment)}
    {#if segment.kind === "text"}
      <section class="prose free-text">{@html renderMarkdown(segment.markdown)}</section>
    {:else if segment.kind === "widget"}
      <section class="widget-card width-{segment.spec.width ?? "full"}">
        <h3>{widgetTitle(segment)}</h3>
        {#if segment.result.kind === "error"}
          <p class="widget-error">{segment.result.message}</p>
        {:else if segment.result.kind === "text"}
          <div class="prose">{@html renderMarkdown(segment.result.text)}</div>
        {:else if segment.result.kind === "rows"}
          <p class="muted">{segment.result.rows.length} row(s)</p>
          <ul>
            {#each segment.result.rows.slice(0, 8) as row, i (i)}
              <li>{String(row.text ?? JSON.stringify(row))}</li>
            {/each}
          </ul>
        {:else if segment.result.kind === "value"}
          <p class="counter">{segment.result.value}</p>
        {:else if segment.result.kind === "group_values"}
          <ul>
            {#each segment.result.groups as g (g.key)}
              <li>{g.key ?? "(null)"}: {g.value}</li>
            {/each}
          </ul>
        {:else if segment.result.kind === "groups"}
          <p class="muted">{segment.result.groups.length} group(s)</p>
        {/if}
      </section>
    {/if}
  {/each}
</div>

<style>
  .dashboard {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .widget-card {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px 14px;
    background: var(--bg-secondary);
  }
  .widget-card.width-half {
    width: calc(50% - 8px);
    display: inline-block;
    vertical-align: top;
  }
  .widget-card.width-third {
    width: calc(33.333% - 8px);
    display: inline-block;
    vertical-align: top;
  }
  h3 {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 600;
  }
  .widget-error {
    color: var(--error-fg);
    background: var(--error-bg);
    border-radius: 8px;
    padding: 8px 10px;
    margin: 0;
    font-size: 13px;
  }
  .muted {
    color: var(--muted);
    font-size: 13px;
    margin: 0 0 6px;
  }
  .counter {
    font-size: 28px;
    font-weight: 600;
    margin: 0;
  }
</style>
