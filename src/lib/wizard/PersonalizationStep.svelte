<script lang="ts">
  import { t } from "../i18n";

  let {
    name = $bindable(""),
    about = $bindable(""),
    onContinue,
  }: {
    name?: string;
    about?: string;
    onContinue: () => void;
  } = $props();

  const canContinue = $derived(name.trim().length > 0);
</script>

<h2>{$t.personalizationTitle}</h2>
<label class="field">
  <span>{$t.personalizationNameLabel}</span>
  <input type="text" bind:value={name} placeholder={$t.personalizationNameHint} spellcheck="false" />
</label>
<label class="field">
  <span>{$t.personalizationAboutLabel}</span>
  <textarea bind:value={about} placeholder={$t.personalizationAboutHint} rows="4"></textarea>
</label>
<button class="primary" onclick={onContinue} disabled={!canContinue}>{$t.wizardContinue}</button>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-start;
    width: min(420px, 80vw);
    text-align: left;
  }
  .field span {
    font-size: 13px;
    color: var(--muted);
  }
  .field input,
  .field textarea {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-secondary);
    color: var(--fg);
    font-size: 14px;
    font-family: inherit;
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
  button.primary:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
