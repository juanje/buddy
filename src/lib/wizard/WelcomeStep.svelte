<script lang="ts">
  import { t } from "../i18n";

  let { onContinue }: { onContinue: () => void } = $props();
</script>

<h2>{$t.wizardTitle}</h2>
<p>{$t.wizardIntro}</p>
<button class="primary" onclick={onContinue}>{$t.wizardContinue}</button>

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
</style>
