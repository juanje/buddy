<script lang="ts">
  import { t } from "./i18n";

  let { onConfirm }: { onConfirm: () => void } = $props();
</script>

<div class="closure-done" role="region" aria-label={$t.closureDone}>
  <button type="button" class="closure-done-button" onclick={onConfirm}>
    {$t.closureDone}
  </button>
</div>

<style>
  .closure-done {
    display: flex;
    justify-content: center;
    padding: 8px 0 4px;
  }
  .closure-done-button {
    border: 1px solid var(--border);
    background: transparent;
    color: var(--fg);
    padding: 6px 14px;
    font-size: 13px;
    border-radius: 8px;
    cursor: pointer;
  }
  .closure-done-button:hover {
    background: var(--bg-secondary);
  }
</style>
