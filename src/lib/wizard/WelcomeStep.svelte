<script lang="ts">
  import { t } from "../i18n";

  let { onContinue, onBack }: { onContinue: () => void; onBack?: () => void } = $props();
</script>

<h2>{$t.wizardTitle}</h2>
<p>{$t.wizardIntro}</p>
<div class="actions">
  {#if onBack}
    <button type="button" class="ghost" onclick={onBack}>{$t.wizardBack}</button>
  {/if}
  <button class="primary" onclick={onContinue}>{$t.wizardContinue}</button>
</div>

<style>
  p {
    max-width: 480px;
    line-height: 1.5;
  }
  button.primary {
    border: 1px solid transparent;
    background: var(--accent, #4f46e5);
    color: #fff;
    border-radius: 8px;
    padding: 8px 20px;
    cursor: pointer;
    font-size: 14px;
  }
  .actions {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
  }
  button.ghost {
    border: none;
    background: transparent;
    color: var(--muted);
    border-radius: 8px;
    padding: 8px 20px;
    cursor: pointer;
    font-size: 14px;
  }
  button.ghost:hover {
    color: var(--fg);
    background: var(--bg-secondary);
  }
</style>
