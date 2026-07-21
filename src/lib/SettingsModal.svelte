<script lang="ts">
  import { t } from "./i18n";
  import { providerLabel, type SettingsController } from "./settings-controller";

  let { controller }: { controller: SettingsController } = $props();

  const open = $derived(controller.open);
  const config = $derived(controller.config);

  function onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      controller.closeSettings();
    }
  }

  async function onLanguageChange(event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    await controller.setLanguage(select.value as "es" | "en");
  }
</script>

{#if $open}
  <div class="backdrop" onclick={onBackdropClick} role="presentation">
    <div class="modal" role="dialog" aria-labelledby="settings-title">
      <header class="header">
        <h2 id="settings-title">{$t.settingsTitle}</h2>
        <button type="button" class="close" onclick={() => controller.closeSettings()}>
          {$t.settingsClose}
        </button>
      </header>

      <dl class="fields">
        <div class="field">
          <dt>{$t.settingsLanguage}</dt>
          <dd>
            <select value={$config.language} onchange={onLanguageChange}>
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </dd>
        </div>
        <div class="field">
          <dt>{$t.settingsProvider}</dt>
          <dd>{providerLabel($config.provider, $t)}</dd>
        </div>
        <div class="field">
          <dt>{$t.settingsModel}</dt>
          <dd>{$config.model}</dd>
        </div>
        <div class="field">
          <dt>{$t.settingsDirectory}</dt>
          <dd class="path">{$config.abDirectory}</dd>
        </div>
        <div class="field">
          <dt>{$t.settingsVersion}</dt>
          <dd>{$config.version}</dd>
        </div>
      </dl>

      <p class="hint">{$t.settingsReadOnlyHint}</p>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.45);
    padding: 24px;
  }
  .modal {
    width: min(480px, 100%);
    max-height: 90vh;
    overflow: auto;
    border-radius: 16px;
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--border);
    padding: 20px 24px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }
  h2 {
    margin: 0;
    font-size: 1.25rem;
  }
  .close {
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    font: inherit;
    padding: 4px 8px;
    border-radius: 8px;
  }
  .close:hover {
    color: var(--fg);
    background: var(--bg-secondary);
  }
  .fields {
    margin: 0;
    display: grid;
    gap: 14px;
  }
  .field {
    display: grid;
    gap: 4px;
  }
  dt {
    font-size: 13px;
    color: var(--muted);
    font-weight: 500;
  }
  dd {
    margin: 0;
    font-size: 15px;
  }
  select {
    font: inherit;
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--fg);
  }
  .path {
    word-break: break-all;
    font-family: ui-monospace, monospace;
    font-size: 13px;
  }
  .hint {
    margin: 16px 0 0;
    font-size: 13px;
    color: var(--muted);
  }
</style>
