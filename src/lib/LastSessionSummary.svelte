<script lang="ts">
  import { t } from "./i18n";

  let { text }: { text: string } = $props();
</script>

<div class="last-session" role="note" aria-label={$t.orientationWhereWeLeftOff}>
  <p class="heading">{$t.orientationWhereWeLeftOff}</p>
  <p class="summary">{text}</p>
</div>

<style>
  .last-session {
    margin: 0 16px 12px;
    padding: 10px 12px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--bg-secondary) 85%, transparent);
    border: 1px dashed var(--border);
    color: var(--muted);
  }
  .heading {
    margin: 0 0 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .summary {
    margin: 0;
    font-size: 13px;
    line-height: 1.45;
    color: var(--fg-secondary);
  }
</style>
