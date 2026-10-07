<script lang="ts">
  import type { WidgetProvenance } from "../../../shared/dashboard/types";
  import { getLocale, t } from "../i18n";
  import { formatAgeDays } from "./view-model";

  let { provenance }: { provenance: WidgetProvenance } = $props();

  const age = $derived(formatAgeDays(provenance.ageDays, getLocale()));
  const basisLine = $derived($t.dashboardBasedOn.replace("{basis}", provenance.basis));
</script>

<p class="provenance">
  <span class="age">{age}</span>
  <span class="basis">{basisLine}</span>
</p>

<style>
  .provenance {
    margin: 0 0 8px;
    font-size: 12px;
    color: var(--muted);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .age {
    font-style: italic;
  }
</style>
