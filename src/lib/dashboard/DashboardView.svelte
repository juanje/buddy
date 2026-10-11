<script lang="ts">
  import type { ResolvedDashboard } from "../../../shared/dashboard/types";
  import { renderMarkdown } from "../markdown";
  import { t } from "../i18n";
  import { buildDashboardViewModel, type DashboardWidgetVm } from "./view-model";
  import CounterView from "./CounterView.svelte";
  import ErrorCard from "./ErrorCard.svelte";
  import KanbanView from "./KanbanView.svelte";
  import ListView from "./ListView.svelte";
  import ProvenanceLine from "./ProvenanceLine.svelte";
  import StatusView from "./StatusView.svelte";
  import TableView from "./TableView.svelte";
  import TextView from "./TextView.svelte";
  import { getLocale } from "../i18n";

  let { model }: { model: ResolvedDashboard } = $props();

  const vm = $derived(
    buildDashboardViewModel(model, getLocale(), $t.dashboardEmptyWidget),
  );

  function widthClass(widget: DashboardWidgetVm): string {
    return `width-${widget.width ?? "full"}`;
  }
</script>

<div class="dashboard">
  {#each vm.rows as row (row)}
    {#if row.kind === "text"}
      <section class="prose free-text">{@html renderMarkdown(row.markdown)}</section>
    {:else}
      <div class="widget-row">
        {#each row.widgets as widget (widget.key)}
          <section class="widget-card {widthClass(widget)}" class:inline-widget={widget.kind !== "error" && widget.provenance}>
            {#if widget.kind !== "error"}
              {#if widget.title}
                <h3>{widget.title}</h3>
              {/if}
              {#if widget.provenance}
                <ProvenanceLine provenance={widget.provenance} />
              {/if}
            {/if}

            {#if widget.kind === "error"}
              <ErrorCard title={widget.title} message={widget.message} />
            {:else if widget.kind === "kanban"}
              <KanbanView columns={widget.columns} emptyLabel={$t.dashboardEmptyWidget} />
            {:else if widget.kind === "list"}
              <ListView items={widget.items} emptyLabel={$t.dashboardEmptyWidget} />
            {:else if widget.kind === "table"}
              <TableView
                headers={widget.headers}
                rows={widget.rows}
                emptyLabel={$t.dashboardEmptyWidget}
                showMoreLabel={$t.dashboardTableShowMore}
                locale={getLocale()}
              />
            {:else if widget.kind === "counter"}
              <CounterView value={widget.value} delta={widget.delta} groups={widget.groups} />
            {:else if widget.kind === "textWidget"}
              <TextView markdown={widget.markdown} />
            {:else if widget.kind === "status"}
              <StatusView cards={widget.cards} emptyLabel={$t.dashboardEmptyWidget} />
            {/if}
          </section>
        {/each}
      </div>
    {/if}
  {/each}
</div>

<style>
  .dashboard {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  header h1 {
    margin: 0 0 4px;
    font-size: 20px;
  }
  .summary {
    margin: 0;
    color: var(--muted);
    font-size: 14px;
  }
  .widget-row {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: stretch;
  }
  .widget-card {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px 14px;
    background: var(--bg-secondary);
    box-sizing: border-box;
    flex: 1 1 100%;
  }
  .widget-card.inline-widget {
    border-style: dashed;
    background: color-mix(in srgb, var(--bg-secondary) 92%, var(--accent) 8%);
  }
  .widget-card.width-half {
    flex: 1 1 calc(50% - 8px);
    max-width: calc(50% - 8px);
  }
  .widget-card.width-third {
    flex: 1 1 calc(33.333% - 8px);
    max-width: calc(33.333% - 8px);
  }
  h3 {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 600;
  }
</style>
