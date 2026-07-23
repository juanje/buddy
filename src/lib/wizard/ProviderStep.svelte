<script lang="ts">
  import type { SetupController } from "../setup-controller";
  import ProviderAuthForm from "../ProviderAuthForm.svelte";
  import { t } from "../i18n";
  import "./wizard-shared.css";

  let {
    controller,
    apiKeyInput = $bindable(""),
    baseUrlInput = $bindable(""),
    onBack,
  }: {
    controller: SetupController;
    apiKeyInput?: string;
    baseUrlInput?: string;
    onBack?: () => void;
  } = $props();

  const provider = $derived(controller.provider);
  const needsBaseUrl = $derived(controller.needsBaseUrl);
  const keyCheck = $derived(controller.keyCheck);
  const validatingKey = $derived(controller.validatingKey);
  const oauthLoggingIn = $derived(controller.oauthLoggingIn);
  const oauthError = $derived(controller.oauthError);
  const showApiKey = $derived(controller.showApiKey);

  const PROVIDERS: Array<{ id: "openai" | "anthropic" | "google" | "custom"; recommended?: boolean }> =
    [
      { id: "openai", recommended: true },
      { id: "anthropic" },
      { id: "google" },
      { id: "custom" },
    ];

  function providerLabel(id: (typeof PROVIDERS)[number]["id"]): string {
    switch (id) {
      case "anthropic":
        return $t.providerAnthropic;
      case "openai":
        return $t.providerOpenai;
      case "google":
        return $t.providerGoogle;
      default:
        return $t.providerCustom;
    }
  }

  async function signInOAuth() {
    await controller.loginOAuth();
    if (controller.read(controller.authReady)) {
      controller.next();
    }
  }

  async function submitKeyAndContinue() {
    await controller.submitApiKey(apiKeyInput, $needsBaseUrl ? baseUrlInput : undefined);
    if (controller.read(controller.keyCheck)?.valid) {
      controller.next();
    }
  }
</script>

<h2>{$t.providerTitle}</h2>
<p class="muted">{$t.providerHint}</p>
<div class="providers">
  {#each PROVIDERS as p (p.id)}
    <button
      class:selected={$provider === p.id}
      onclick={() => controller.selectProvider(p.id)}
    >
      {providerLabel(p.id)}
      {#if p.recommended}
        <span class="badge">{$t.modelRecommended}</span>
      {/if}
    </button>
  {/each}
</div>

{#if $provider}
  <ProviderAuthForm
    provider={$provider}
    showApiKey={$showApiKey}
    loggingIn={$oauthLoggingIn || $validatingKey}
    error={$oauthError || ($keyCheck && !$keyCheck.valid ? $keyCheck.error : null)}
    needsBaseUrl={$needsBaseUrl}
    bind:apiKeyInput
    bind:baseUrlInput
    onOAuthClick={signInOAuth}
    onSubmitKey={submitKeyAndContinue}
    onToggleMode={(show) => controller.setShowApiKey(show)}
  />
{/if}

{#if onBack}
  <div class="actions">
    <button type="button" class="ghost" onclick={onBack}>{$t.wizardBack}</button>
  </div>
{/if}

<style>
  .muted {
    color: var(--muted);
    font-size: 13px;
  }
  .providers {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }
  .providers button {
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--fg);
    border-radius: 8px;
    padding: 8px 16px;
    cursor: pointer;
    font-size: 14px;
  }
  .providers button.selected {
    border-color: var(--accent, #4f46e5);
    outline: 2px solid var(--accent, #4f46e5);
  }
  .actions {
    margin-top: 12px;
  }
</style>
