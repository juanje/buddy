<script lang="ts">
  import { t } from "./i18n";
  import { supportsOAuth } from "./provider-setup";
  import {
    groupModelsByProvider,
    modelSelectValue,
    parseModelSelectValue,
    providerLabel,
    type SettingsController,
  } from "./settings-controller";

  let { controller }: { controller: SettingsController } = $props();

  const open = $derived(controller.open);
  const config = $derived(controller.config);
  const models = $derived(controller.models);
  const loadingModels = $derived(controller.loadingModels);
  const addingProvider = $derived(controller.addingProvider);
  const authProvider = $derived(controller.authProvider);
  const authLoggingIn = $derived(controller.authLoggingIn);
  const authError = $derived(controller.authError);
  const authShowApiKey = $derived(controller.authShowApiKey);
  const unauthenticatedProviders = $derived(controller.unauthenticatedProviders);
  const providerAddedNotice = $derived(controller.providerAddedNotice);

  let apiKeyInput = $state("");
  let baseUrlInput = $state("");

  const currentModelValue = $derived(modelSelectValue($config.provider, $config.model));
  const providerGroups = $derived(groupModelsByProvider($models, $t));
  const showAddProviderLink = $derived($unauthenticatedProviders.length > 0 && !$addingProvider);
  const authNeedsBaseUrl = $derived($authProvider === "custom");

  function onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      controller.closeSettings();
    }
  }

  async function onLanguageChange(event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    await controller.setLanguage(select.value as "es" | "en");
  }

  async function onModelChange(event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    const { provider, model } = parseModelSelectValue(select.value);
    await controller.setModel(provider, model);
  }

  async function submitApiKey() {
    await controller.submitAuthApiKey(apiKeyInput, $authNeedsBaseUrl ? baseUrlInput : undefined);
    if (!$authError) {
      apiKeyInput = "";
      baseUrlInput = "";
    }
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
          <dd>
            {#if $loadingModels}
              <span class="muted">{$t.settingsModelLoading}</span>
            {:else if $models.length > 0}
              <select value={currentModelValue} onchange={onModelChange}>
                {#each providerGroups as group (group.provider)}
                  <optgroup label={group.label}>
                    {#each group.models as m (m.id)}
                      <option value={modelSelectValue(m.provider, m.id)}>{m.label}</option>
                    {/each}
                  </optgroup>
                {/each}
              </select>
            {:else}
              {$config.model}
            {/if}
          </dd>
        </div>
        {#if $providerAddedNotice}
          <p class="notice">{$t.settingsProviderAdded}</p>
        {/if}
        {#if showAddProviderLink}
          <button type="button" class="link" onclick={() => controller.startAddProvider()}>
            {$t.settingsAddProvider}
          </button>
        {/if}
        {#if $addingProvider}
          <div class="add-provider">
            <div class="provider-buttons">
              {#each $unauthenticatedProviders as p (p)}
                <button
                  type="button"
                  class:selected={$authProvider === p}
                  onclick={() => controller.selectAuthProvider(p)}
                >
                  {providerLabel(p, $t)}
                </button>
              {/each}
            </div>
            {#if $authProvider}
              {#if supportsOAuth($authProvider) && !$authShowApiKey}
                <button
                  type="button"
                  class="primary"
                  onclick={() => controller.submitAuthOAuth()}
                  disabled={$authLoggingIn}
                >
                  {$authLoggingIn ? $t.oauthWaiting : $t.oauthSignIn}
                </button>
                <button type="button" class="link" onclick={() => controller.setAuthShowApiKey(true)}>
                  {$t.oauthUseApiKey}
                </button>
              {:else}
                {#if supportsOAuth($authProvider)}
                  <button type="button" class="link" onclick={() => controller.setAuthShowApiKey(false)}>
                    {$t.oauthBackToSignIn}
                  </button>
                {/if}
                {#if $authNeedsBaseUrl}
                  <label class="inline-field">
                    <span>{$t.baseUrlLabel}</span>
                    <input type="text" bind:value={baseUrlInput} spellcheck="false" />
                  </label>
                {/if}
                <label class="inline-field">
                  <span>{$t.apiKeyLabel}</span>
                  <input type="password" bind:value={apiKeyInput} spellcheck="false" />
                </label>
                <button
                  type="button"
                  class="primary"
                  onclick={submitApiKey}
                  disabled={$authLoggingIn || apiKeyInput.length === 0}
                >
                  {$authLoggingIn ? $t.apiKeyValidating : $t.apiKeyValidate}
                </button>
              {/if}
            {/if}
            {#if $authError}
              <p class="error">{$authError}</p>
            {/if}
            <button type="button" class="link" onclick={() => controller.cancelAddProvider()}>
              {$t.oauthCancel}
            </button>
          </div>
        {/if}
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
    max-width: 100%;
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
  .muted {
    font-size: 13px;
    color: var(--muted);
  }
  .notice {
    margin: 0;
    font-size: 13px;
    color: var(--accent, #4f46e5);
  }
  .link {
    border: none;
    background: transparent;
    color: var(--muted);
    font-size: 13px;
    cursor: pointer;
    text-decoration: underline;
    padding: 0;
    justify-self: start;
  }
  .add-provider {
    display: grid;
    gap: 10px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--bg-secondary);
  }
  .provider-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .provider-buttons button {
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg);
    border-radius: 8px;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 13px;
  }
  .provider-buttons button.selected {
    border-color: var(--accent, #4f46e5);
    outline: 2px solid var(--accent, #4f46e5);
  }
  button.primary {
    border: none;
    background: var(--accent, #4f46e5);
    color: #fff;
    border-radius: 8px;
    padding: 8px 16px;
    cursor: pointer;
    font-size: 14px;
    justify-self: start;
  }
  .inline-field {
    display: grid;
    gap: 4px;
  }
  .inline-field span {
    font-size: 13px;
    color: var(--muted);
  }
  .inline-field input {
    font: inherit;
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg);
  }
  .error {
    margin: 0;
    color: var(--error-fg);
    background: var(--error-bg);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 13px;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
