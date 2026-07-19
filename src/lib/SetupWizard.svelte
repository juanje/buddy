<script lang="ts">
  // Setup wizard (FR-SETUP-01 routing target).
  // Steps built out feature by feature: FR-SETUP-02 prerequisites gate ·
  // FR-SETUP-03 location picker · (FR-SETUP-04 provider, 05 model next).
  import { onMount } from "svelte";
  import { createSetupController } from "./setup-controller";
  import { modelChoicesFor } from "./model-catalog";
  import { gitInstallInstructions, t, tierDescription } from "./i18n";
  import type { SetupWorkerAPI } from "../../shared/api";

  let {
    worker,
    onComplete,
  }: { worker: SetupWorkerAPI; onComplete?: () => void } = $props();

  const wizard = createSetupController(worker);
  const step = wizard.step;
  const prereq = wizard.prereq;
  const checking = wizard.checking;
  const canProceed = wizard.canProceed;
  const locationCheck = wizard.locationCheck;
  const provider = wizard.provider;
  const needsBaseUrl = wizard.needsBaseUrl;
  const keyCheck = wizard.keyCheck;
  const validatingKey = wizard.validatingKey;
  const model = wizard.model;
  const setupError = wizard.setupError;

  async function createAb() {
    try {
      await wizard.finishSetup();
      onComplete?.();
    } catch {
      // setupError store carries the message; the creating step shows it.
    }
  }

  // Local input values (validated on continue).
  let locationInput = $state("");
  let apiKeyInput = $state("");
  let baseUrlInput = $state("");

  const PROVIDERS: Array<{ id: "anthropic" | "openai" | "google" | "custom"; label: string }> = [
    { id: "anthropic", label: t.providerAnthropic },
    { id: "openai", label: t.providerOpenai },
    { id: "google", label: t.providerGoogle },
    { id: "custom", label: t.providerCustom },
  ];

  async function submitKeyAndMaybeContinue() {
    await wizard.submitApiKey(apiKeyInput, $needsBaseUrl ? baseUrlInput : undefined);
    wizard.next(); // no-op if the key was rejected
  }

  onMount(async () => {
    void wizard.checkPrerequisites();
    locationInput = await wizard.loadDefaultLocation();
  });

  async function validateAndMaybeContinue() {
    await wizard.pickLocation(locationInput);
    wizard.next(); // no-op if the location was rejected
  }

  function locationError(status: string): string | undefined {
    switch (status) {
      case "not-empty":
        return t.locationNotEmpty;
      case "not-a-directory":
        return t.locationNotADirectory;
      case "existing-ab":
        // FR-SETUP-08 will turn this into an import flow.
        return t.locationExistingAb;
      default:
        return undefined;
    }
  }
</script>

<div class="wizard">
  <h1>{t.wizardTitle}</h1>
  <p>{t.wizardIntro}</p>

  {#if $step === "prerequisites"}
    {#if $prereq && !$prereq.gitInstalled}
      <div class="blocker">
        <p>{t.gitRequired}</p>
        <p class="instructions">{gitInstallInstructions($prereq.platform)}</p>
        <button onclick={() => wizard.checkPrerequisites()} disabled={$checking}>
          {$checking ? t.gitChecking : t.gitCheckRetry}
        </button>
      </div>
    {:else}
      <button
        class="primary"
        onclick={() => wizard.next()}
        disabled={!$canProceed || $checking}
      >
        {$checking ? t.gitChecking : t.wizardContinue}
      </button>
    {/if}
  {:else if $step === "location"}
    <h2>{t.locationTitle}</h2>
    <p class="muted">{t.locationHint}</p>
    <input class="location" type="text" bind:value={locationInput} spellcheck="false" />
    {#if $locationCheck && locationError($locationCheck.status)}
      <p class="error">{locationError($locationCheck.status)}</p>
    {/if}
    <button class="primary" onclick={validateAndMaybeContinue}>
      {t.wizardContinue}
    </button>
  {:else if $step === "provider"}
    <h2>{t.providerTitle}</h2>
    <p class="muted">{t.providerHint}</p>
    <div class="providers">
      {#each PROVIDERS as p (p.id)}
        <button
          class:selected={$provider === p.id}
          onclick={() => wizard.selectProvider(p.id)}
        >
          {p.label}
        </button>
      {/each}
    </div>
    {#if $provider}
      {#if $needsBaseUrl}
        <label class="field">
          <span>{t.baseUrlLabel}</span>
          <input type="text" bind:value={baseUrlInput} spellcheck="false" />
        </label>
      {/if}
      <label class="field">
        <span>{t.apiKeyLabel}</span>
        <input type="password" bind:value={apiKeyInput} spellcheck="false" />
      </label>
      {#if $keyCheck && !$keyCheck.valid}
        <p class="error">{$keyCheck.error}</p>
      {/if}
      <button
        class="primary"
        onclick={submitKeyAndMaybeContinue}
        disabled={$validatingKey || apiKeyInput.length === 0}
      >
        {$validatingKey ? t.apiKeyValidating : t.apiKeyValidate}
      </button>
    {/if}
  {:else if $step === "model"}
    <h2>{t.modelTitle}</h2>
    <p class="muted">{t.modelHint}</p>
    {#if $provider && modelChoicesFor($provider)}
      <div class="models">
        {#each modelChoicesFor($provider)! as choice (choice.id)}
          <button
            class="model-card"
            class:selected={$model === choice.id}
            onclick={() => wizard.selectModel(choice.id)}
          >
            <strong>
              {choice.label}
              {#if choice.recommended}
                <span class="badge">{t.modelRecommended}</span>
              {/if}
            </strong>
            <span class="tier">{tierDescription(choice.tier)}</span>
          </button>
        {/each}
      </div>
    {:else}
      <label class="field">
        <span>{t.modelCustomLabel}</span>
        <input
          type="text"
          spellcheck="false"
          value={$model ?? ""}
          oninput={(e) => wizard.selectModel(e.currentTarget.value)}
        />
      </label>
      <p class="muted">{t.modelCustomHint}</p>
    {/if}
    <button class="primary" onclick={createAb} disabled={!$canProceed}>
      {t.wizardContinue}
    </button>
  {:else if $step === "creating"}
    {#if $setupError}
      <p class="error">{t.creatingError}: {$setupError}</p>
      <button class="primary" onclick={createAb}>{t.creatingRetry}</button>
    {:else}
      <h2>{t.creatingTitle}</h2>
      <p class="muted">{t.creatingHint}</p>
    {/if}
  {:else}
    <p class="muted">{t.wizardComingSoon}</p>
  {/if}
</div>

<style>
  .wizard {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 12px;
    padding: 32px;
    text-align: center;
  }
  .wizard h1 {
    font-size: 24px;
  }
  .wizard p {
    max-width: 480px;
    line-height: 1.5;
  }
  .muted {
    color: var(--muted);
    font-size: 13px;
  }
  .blocker {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: center;
    border: 1px solid var(--error-fg);
    background: var(--error-bg);
    color: var(--error-fg);
    border-radius: 12px;
    padding: 16px 20px;
  }
  .instructions {
    font-size: 13px;
  }
  button {
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--fg);
    border-radius: 8px;
    padding: 8px 20px;
    cursor: pointer;
    font-size: 14px;
  }
  button.primary {
    background: var(--accent, #4f46e5);
    border-color: transparent;
    color: #fff;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .wizard h2 {
    font-size: 18px;
  }
  input.location {
    width: min(480px, 80vw);
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-secondary);
    color: var(--fg);
    font-size: 14px;
    font-family: ui-monospace, monospace;
  }
  .error {
    color: var(--error-fg);
    background: var(--error-bg);
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 13px;
  }
  .providers {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }
  .providers button.selected {
    border-color: var(--accent, #4f46e5);
    outline: 2px solid var(--accent, #4f46e5);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-start;
  }
  .field span {
    font-size: 13px;
    color: var(--muted);
  }
  .field input {
    width: min(420px, 80vw);
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-secondary);
    color: var(--fg);
    font-size: 14px;
  }
  .models {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: min(420px, 80vw);
  }
  .model-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-start;
    text-align: left;
    padding: 10px 14px;
  }
  .model-card.selected {
    border-color: var(--accent, #4f46e5);
    outline: 2px solid var(--accent, #4f46e5);
  }
  .model-card .tier {
    font-size: 12px;
    color: var(--muted);
  }
  .badge {
    font-size: 11px;
    color: var(--accent, #4f46e5);
    border: 1px solid var(--accent, #4f46e5);
    border-radius: 999px;
    padding: 1px 8px;
    margin-left: 6px;
  }
</style>
