<script lang="ts">
  // Setup wizard (FR-SETUP-01 routing target).
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import { createSetupController } from "./setup-controller";
  import { gitInstallInstructions, t } from "./i18n";
  import LanguageStep from "./wizard/LanguageStep.svelte";
  import WelcomeStep from "./wizard/WelcomeStep.svelte";
  import PersonalizationStep from "./wizard/PersonalizationStep.svelte";
  import ProviderStep from "./wizard/ProviderStep.svelte";
  import ModelStep from "./wizard/ModelStep.svelte";
  import type { OAuthUIEvent, SetupWorkerAPI } from "../../shared/api";

  let {
    worker,
    onComplete,
    onSetupFailed,
    onRegisterOAuth,
  }: {
    worker: SetupWorkerAPI;
    onComplete?: () => void;
    onSetupFailed?: () => void;
    /** App registers wizard as OAuth event consumer (browser open lives in App). */
    onRegisterOAuth?: (handler: (event: OAuthUIEvent) => void) => () => void;
  } = $props();

  const wizard = createSetupController(worker);
  const step = wizard.step;
  const prereq = wizard.prereq;
  const checking = wizard.checking;
  const canProceed = wizard.canProceed;
  const locationCheck = wizard.locationCheck;
  const setupError = wizard.setupError;
  const oauthPrompt = wizard.oauthPrompt;

  let nameInput = $state("");
  let aboutInput = $state("");
  let locationInput = $state("");
  let apiKeyInput = $state("");
  let baseUrlInput = $state("");
  let oauthPromptInput = $state("");

  onMount(() => {
    const unregister = onRegisterOAuth?.((event) => wizard.handleOAuthEvent(event));
    void wizard.checkPrerequisites();
    void wizard.loadDefaultLocation().then((path) => {
      locationInput = path;
    });
    return unregister;
  });

  async function createAb() {
    try {
      wizard.beginCreating();
      onComplete?.();
      await wizard.finishSetup();
    } catch {
      onSetupFailed?.();
    }
  }

  async function importExistingAb() {
    try {
      const result = await wizard.importExisting();
      if (result === "adopted") onComplete?.();
    } catch {
      onSetupFailed?.();
    }
  }

  async function validateAndMaybeContinue() {
    await wizard.pickLocation(locationInput);
    const auth = get(wizard.detectedAuth);
    if (auth && (!auth.options || auth.options.length <= 1)) {
      wizard.next();
      if (get(wizard.step) === "creating") {
        onComplete?.();
        try {
          await wizard.finishSetup();
        } catch {
          onSetupFailed?.();
        }
      }
    } else {
      wizard.next();
    }
  }

  function pickDetectedAndFinish(piProvider: string) {
    wizard.selectDetectedProvider(piProvider);
    createAb();
  }

  function locationError(status: string): string | undefined {
    switch (status) {
      case "not-empty":
        return $t.locationNotEmpty;
      case "not-a-directory":
        return $t.locationNotADirectory;
      case "existing-ab":
        return $t.locationExistingAb;
      default:
        return undefined;
    }
  }

  function savePersonalizationAndContinue() {
    wizard.setPersonalization(nameInput, aboutInput);
    wizard.next();
  }

  async function submitOAuthPrompt() {
    await wizard.answerOAuthPrompt(oauthPromptInput);
    oauthPromptInput = "";
  }
</script>

<div class="wizard">
  {#if $step === "language"}
    <LanguageStep onSelect={(lang) => wizard.selectLanguage(lang)} />
  {:else if $step === "welcome"}
    <WelcomeStep onContinue={() => wizard.next()} />
  {:else if $step === "personalization"}
    <PersonalizationStep
      bind:name={nameInput}
      bind:about={aboutInput}
      onContinue={savePersonalizationAndContinue}
    />
  {:else if $step === "prerequisites"}
    <h1>{$t.wizardTitle}</h1>
    {#if $prereq && !$prereq.gitInstalled}
      <div class="blocker">
        <p>{$t.gitRequired}</p>
        <p class="instructions">{gitInstallInstructions($prereq.platform)}</p>
        <button onclick={() => wizard.checkPrerequisites()} disabled={$checking}>
          {$checking ? $t.gitChecking : $t.gitCheckRetry}
        </button>
      </div>
    {:else}
      <button class="primary" onclick={() => wizard.next()} disabled={!$canProceed || $checking}>
        {$checking ? $t.gitChecking : $t.wizardContinue}
      </button>
    {/if}
  {:else if $step === "location"}
    <h2>{$t.locationTitle}</h2>
    <p class="muted">{$t.locationHint}</p>
    <input class="location" type="text" bind:value={locationInput} spellcheck="false" />
    {#if $locationCheck && locationError($locationCheck.status)}
      <p class="error">{locationError($locationCheck.status)}</p>
    {/if}
    {#if $locationCheck?.status === "existing-ab"}
      <button class="primary" onclick={importExistingAb}>{$t.locationImport}</button>
    {:else}
      <button class="primary" onclick={validateAndMaybeContinue}>
        {$t.wizardContinue}
      </button>
    {/if}
  {:else if $step === "provider"}
    <ProviderStep controller={wizard} bind:apiKeyInput bind:baseUrlInput />
  {:else if $step === "model"}
    <ModelStep controller={wizard} onContinue={createAb} />
  {:else if $step === "creating"}
    {#if $setupError}
      <p class="error">{$t.creatingError}: {$setupError}</p>
      <button class="primary" onclick={createAb}>{$t.creatingRetry}</button>
    {:else}
      <h2>{$t.creatingTitle}</h2>
      <p class="muted">{$t.creatingHint}</p>
    {/if}
  {:else}
    <p class="muted">{$t.wizardComingSoon}</p>
  {/if}

  {#if $oauthPrompt?.type === "prompt"}
    <div class="oauth-prompt">
      <p>{$oauthPrompt.message}</p>
      {#if $oauthPrompt.promptType === "select" && $oauthPrompt.options}
        <select bind:value={oauthPromptInput}>
          {#each $oauthPrompt.options as opt (opt)}
            <option value={opt}>{opt}</option>
          {/each}
        </select>
      {:else}
        <input type="text" bind:value={oauthPromptInput} placeholder={$oauthPrompt.placeholder} />
      {/if}
      <button class="primary" onclick={submitOAuthPrompt}>{$t.wizardContinue}</button>
      <button onclick={() => wizard.cancelOAuthLogin()}>{$t.oauthCancel}</button>
    </div>
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
  .wizard h2 {
    font-size: 18px;
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
  .oauth-prompt {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 280px;
    z-index: 20;
  }
</style>
