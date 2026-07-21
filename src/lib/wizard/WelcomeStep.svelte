<script lang="ts">
  import { t } from "../i18n";
  import "./wizard-shared.css";

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
</style>
