<script lang="ts">
  import { t } from "./i18n";
  import ProviderAuthForm from "./ProviderAuthForm.svelte";
  import {
    providerLabel,
    type SettingsController,
    type SettingsProviderId,
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
  const usage = $derived(controller.usage);
  const usageLoading = $derived(controller.usageLoading);

  let apiKeyInput = $state("");
  let baseUrlInput = $state("");

  const authenticatedProviders = $derived(
    [...new Set($models.map((m) => m.provider))] as SettingsProviderId[],
  );
  const modelsForCurrentProvider = $derived(
    $models.filter((m) => m.provider === $config.provider),
  );
  const showAddProviderLink = $derived($unauthenticatedProviders.length > 0 && !$addingProvider);
  const authNeedsBaseUrl = $derived($authProvider === "custom");
  const currentProviderNeedsAuth = $derived(
    !$loadingModels &&
      !authenticatedProviders.includes($config.provider) &&
      $unauthenticatedProviders.includes($config.provider),
  );

  function onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      controller.closeSettings();
    }
  }

  async function onLanguageChange(event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    await controller.setLanguage(select.value as "es" | "en");
  }

  async function onProviderChange(event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    const provider = select.value as SettingsProviderId;
    const providerModels = $models.filter((m) => m.provider === provider);
    const remembered = controller.getLastModelForProvider(provider);
    const model =
      remembered && providerModels.some((m) => m.id === remembered)
        ? remembered
        : providerModels[0]?.id ?? $config.model;
    await controller.setModel(provider, model);
  }

  async function onModelChange(event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    await controller.setModel($config.provider, select.value);
  }

  async function submitApiKey() {
    await controller.submitAuthApiKey(apiKeyInput, authNeedsBaseUrl ? baseUrlInput : undefined);
    if (!$authError) {
      apiKeyInput = "";
      baseUrlInput = "";
    }
  }

  const budgetPercent = $derived(
    $usage && $usage.budget.budget
      ? Math.min(100, $usage.budget.percent)
      : 0,
  );
  const budgetBarClass = $derived(
    $usage?.budget.level === "exceeded"
      ? "danger"
      : $usage?.budget.level === "warning"
        ? "warning"
        : "ok",
  );

  async function onBudgetChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const raw = input.value.trim();
    if (raw === "") {
      await controller.setMonthlyBudget(null);
      return;
    }
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      await controller.setMonthlyBudget(parsed === 0 ? null : parsed);
    }
  }

  async function disableBudget() {
    await controller.setMonthlyBudget(null);
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
            <select onchange={onLanguageChange}>
              <option value="es" selected={$config.language === "es"}>Español</option>
              <option value="en" selected={$config.language === "en"}>English</option>
            </select>
          </dd>
        </div>
        <div class="field">
          <dt>{$t.settingsProvider}</dt>
          <dd>
            {#if $loadingModels}
              <span class="muted">{$t.modelLoading}</span>
            {:else if authenticatedProviders.length > 0}
              <select onchange={onProviderChange}>
                {#each authenticatedProviders as p (p)}
                  <option value={p} selected={p === $config.provider}>{providerLabel(p, $t)}</option>
                {/each}
              </select>
            {:else}
              {providerLabel($config.provider, $t)}
            {/if}
            {#if currentProviderNeedsAuth && !$addingProvider}
              <p class="auth-required">
                {$t.settingsAuthRequired.replace(
                  "{provider}",
                  providerLabel($config.provider, $t),
                )}
              </p>
              <button
                type="button"
                class="link"
                onclick={() => controller.startAddProvider($config.provider)}
              >
                {$t.oauthSignIn}
              </button>
            {/if}
          </dd>
        </div>
        {#if $providerAddedNotice}
          <p class="notice">{$t.settingsProviderAdded}</p>
        {/if}
        {#if showAddProviderLink}
          <button type="button" class="link" onclick={() => controller.startAddProvider()}>
            + {$t.settingsAddProvider}
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
              <ProviderAuthForm
                provider={$authProvider}
                showApiKey={$authShowApiKey}
                loggingIn={$authLoggingIn}
                error={$authError}
                needsBaseUrl={authNeedsBaseUrl}
                bind:apiKeyInput
                bind:baseUrlInput
                onOAuthClick={() => controller.submitAuthOAuth()}
                onSubmitKey={submitApiKey}
                onToggleMode={(show) => controller.setAuthShowApiKey(show)}
              />
            {/if}
            <button type="button" class="link" onclick={() => controller.cancelAddProvider()}>
              {$t.oauthCancel}
            </button>
          </div>
        {/if}
        <div class="field">
          <dt>{$t.settingsModel}</dt>
          <dd>
            {#if $loadingModels}
              <span class="muted">{$t.modelLoading}</span>
            {:else if modelsForCurrentProvider.length > 0}
              <select onchange={onModelChange}>
                {#each modelsForCurrentProvider as m (m.id)}
                  <option value={m.id} selected={m.id === $config.model}>{m.label}</option>
                {/each}
              </select>
            {:else}
              {$config.model}
            {/if}
          </dd>
        </div>
        <div class="field">
          <dt>{$t.settingsUsage}</dt>
          <dd class="usage-panel">
            {#if $usageLoading}
              <span class="muted">{$t.settingsUsageLoading}</span>
            {:else if $usage}
              <p>{$t.settingsSessionCost.replace("{amount}", controller.formatCost($usage.session.totalCost))}</p>
              <p>
                {$t.settingsMonthlyCost
                  .replace("{spent}", controller.formatCost($usage.monthly.totalCost))
                  .replace(
                    "{budget}",
                    $config.monthlyBudget == null
                      ? $t.settingsBudgetDisabled
                      : controller.formatCost($config.monthlyBudget),
                  )}
              </p>
              {#if $config.monthlyBudget != null}
                <div class="budget-bar" aria-hidden="true">
                  <div class="budget-fill {budgetBarClass}" style:width="{budgetPercent}%"></div>
                </div>
              {/if}
              <label class="budget-field">
                <span>{$t.settingsMonthlyBudget}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={$config.monthlyBudget ?? ""}
                  placeholder={$t.settingsBudgetDisabled}
                  onchange={onBudgetChange}
                />
              </label>
              {#if $config.monthlyBudget != null}
                <button type="button" class="link" onclick={disableBudget}>
                  {$t.settingsDisableBudget}
                </button>
              {/if}
            {:else}
              <span class="muted">{$t.settingsUsageUnavailable}</span>
            {/if}
          </dd>
        </div>
        <div class="field">
          <dt>{$t.settingsDirectory}</dt>
          <dd class="path">{$config.rootDir}</dd>
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
    appearance: none;
    -webkit-appearance: none;
    font: inherit;
    padding: 6px 10px;
    padding-right: 28px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--fg);
    max-width: 100%;
    cursor: pointer;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M3 4.5L6 8l3-3.5H3z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
  }
  .path {
    word-break: break-all;
    font-family: ui-monospace, monospace;
    font-size: 13px;
  }
  .usage-panel {
    display: grid;
    gap: 8px;
  }
  .usage-panel p {
    margin: 0;
  }
  .budget-bar {
    height: 8px;
    border-radius: 999px;
    background: var(--border);
    overflow: hidden;
  }
  .budget-fill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.2s ease;
  }
  .budget-fill.ok {
    background: var(--status-ok);
  }
  .budget-fill.warning {
    background: var(--status-warn);
  }
  .budget-fill.danger {
    background: var(--status-error);
  }
  .budget-field {
    display: grid;
    gap: 4px;
    font-size: 13px;
  }
  .budget-field input {
    font: inherit;
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--fg);
    max-width: 140px;
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
    color: var(--accent);
  }
  .auth-required {
    margin: 6px 0 0;
    font-size: 13px;
    color: var(--muted);
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
    border-color: var(--accent);
    outline: 2px solid var(--accent);
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
