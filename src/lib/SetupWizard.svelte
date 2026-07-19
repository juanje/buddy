<script lang="ts">
  // Setup wizard (FR-SETUP-01 routing target).
  // Steps built out feature by feature: FR-SETUP-02 prerequisites gate ·
  // FR-SETUP-03 location picker · (FR-SETUP-04 provider, 05 model next).
  import { onMount } from "svelte";
  import { createSetupController } from "./setup-controller";
  import { gitInstallInstructions, t } from "./i18n";
  import type { SetupWorkerAPI } from "../../shared/api";

  let { worker }: { worker: SetupWorkerAPI } = $props();

  const wizard = createSetupController(worker);
  const step = wizard.step;
  const prereq = wizard.prereq;
  const checking = wizard.checking;
  const canProceed = wizard.canProceed;
  const locationCheck = wizard.locationCheck;

  // Local input value for the location step (validated on change/continue).
  let locationInput = $state("");

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
</style>
