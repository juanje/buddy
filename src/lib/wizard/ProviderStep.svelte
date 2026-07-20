<script lang="ts">
  import type { SetupController } from "../setup-controller";
  import { supportsOAuth } from "../provider-setup";
  import { t } from "../i18n";

  let {
    controller,
    apiKeyInput = $bindable(""),
    baseUrlInput = $bindable(""),
  }: {
    controller: SetupController;
    apiKeyInput?: string;
    baseUrlInput?: string;
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
  {#if supportsOAuth($provider) && !$showApiKey}
    <button class="primary oauth" onclick={signInOAuth} disabled={$oauthLoggingIn}>
      {$oauthLoggingIn ? $t.oauthWaiting : $t.oauthSignIn}
    </button>
    {#if $oauthError}
      <p class="error">{$oauthError}</p>
    {/if}
    <button class="link" type="button" onclick={() => controller.setShowApiKey(true)}>
      {$t.oauthUseApiKey}
    </button>
  {:else}
    {#if supportsOAuth($provider)}
      <button class="link" type="button" onclick={() => controller.setShowApiKey(false)}>
        {$t.oauthBackToSignIn}
      </button>
    {/if}
    {#if $needsBaseUrl}
      <label class="field">
        <span>{$t.baseUrlLabel}</span>
        <input type="text" bind:value={baseUrlInput} spellcheck="false" />
      </label>
    {/if}
    <label class="field">
      <span>{$t.apiKeyLabel}</span>
      <input type="password" bind:value={apiKeyInput} spellcheck="false" />
    </label>
    {#if $keyCheck && !$keyCheck.valid}
      <p class="error">{$keyCheck.error}</p>
    {/if}
    <button
      class="primary"
      onclick={submitKeyAndContinue}
      disabled={$validatingKey || apiKeyInput.length === 0}
    >
      {$validatingKey ? $t.apiKeyValidating : $t.apiKeyValidate}
    </button>
  {/if}
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
  .error {
    color: var(--error-fg);
    background: var(--error-bg);
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 13px;
  }
  button.primary {
    background: var(--accent, #4f46e5);
    border-color: transparent;
    color: #fff;
    border-radius: 8px;
    padding: 8px 20px;
    cursor: pointer;
    font-size: 14px;
  }
  button.primary.oauth {
    margin-top: 8px;
  }
  button.link {
    border: none;
    background: transparent;
    color: var(--muted);
    font-size: 13px;
    cursor: pointer;
    text-decoration: underline;
    margin-top: 8px;
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
