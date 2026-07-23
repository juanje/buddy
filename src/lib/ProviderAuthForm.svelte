<script lang="ts">
  import { supportsOAuth } from "./provider-setup";
  import { t } from "./i18n";

  let {
    provider,
    showApiKey,
    loggingIn,
    error = null,
    needsBaseUrl,
    apiKeyInput = $bindable(""),
    baseUrlInput = $bindable(""),
    onOAuthClick,
    onSubmitKey,
    onToggleMode,
  }: {
    provider: string;
    showApiKey: boolean;
    loggingIn: boolean;
    error?: string | null;
    needsBaseUrl: boolean;
    apiKeyInput?: string;
    baseUrlInput?: string;
    onOAuthClick: () => void;
    onSubmitKey: () => void;
    onToggleMode: (showKey: boolean) => void;
  } = $props();

  const oauthAvailable = $derived(supportsOAuth(provider as Parameters<typeof supportsOAuth>[0]));
</script>

{#if oauthAvailable && !showApiKey}
  <button type="button" class="primary oauth" onclick={onOAuthClick} disabled={loggingIn}>
    {loggingIn ? $t.oauthWaiting : $t.oauthSignIn}
  </button>
  {#if error}
    <p class="error">{error}</p>
  {/if}
  <button type="button" class="link" onclick={() => onToggleMode(true)}>
    {$t.oauthUseApiKey}
  </button>
{:else}
  {#if oauthAvailable}
    <button type="button" class="link" onclick={() => onToggleMode(false)}>
      {$t.oauthBackToSignIn}
    </button>
  {/if}
  {#if needsBaseUrl}
    <label class="field">
      <span>{$t.baseUrlLabel}</span>
      <input type="text" bind:value={baseUrlInput} spellcheck="false" />
    </label>
  {/if}
  <label class="field">
    <span>{$t.apiKeyLabel}</span>
    <input type="password" bind:value={apiKeyInput} spellcheck="false" />
  </label>
  {#if error}
    <p class="error">{error}</p>
  {/if}
  <button
    type="button"
    class="primary"
    onclick={onSubmitKey}
    disabled={loggingIn || apiKeyInput.length === 0}
  >
    {loggingIn ? $t.apiKeyValidating : $t.apiKeyValidate}
  </button>
{/if}

<style>
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
    margin: 0;
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
  button.primary.oauth {
    margin-top: 8px;
  }
  button.primary:disabled {
    opacity: 0.5;
    cursor: default;
  }
  button.link {
    border: none;
    background: transparent;
    color: var(--muted);
    font-size: 13px;
    cursor: pointer;
    text-decoration: underline;
    margin-top: 8px;
    padding: 0;
    justify-self: start;
  }
</style>
