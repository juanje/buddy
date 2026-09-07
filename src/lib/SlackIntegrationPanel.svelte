<script lang="ts">
  import type { ConnectorConfig } from "../../shared/api";
  import { t } from "./i18n";

  let {
    config = $bindable<ConnectorConfig>({
      enabled: false,
      token: "",
      cookie: "",
    }),
    testing = false,
    testStatus = "idle" as "idle" | "ok" | "error",
    testError = undefined as string | undefined,
    showSecrets = false,
    onSave,
    onTest,
    onToggleShowSecrets,
  }: {
    config?: ConnectorConfig;
    testing?: boolean;
    testStatus?: "idle" | "ok" | "error";
    testError?: string | undefined;
    showSecrets?: boolean;
    onSave: () => void | Promise<void>;
    onTest: () => void | Promise<void>;
    onToggleShowSecrets: (show: boolean) => void;
  } = $props();

  let savedNotice = $state<"saved" | "restart" | false>(false);
  let savedNoticeTimer: ReturnType<typeof setTimeout> | undefined;
  let enabledToggled = $state(false);

  function dismissSavedNotice() {
    savedNotice = false;
    if (savedNoticeTimer) {
      clearTimeout(savedNoticeTimer);
      savedNoticeTimer = undefined;
    }
  }

  function showSavedNotice(enabledChanged: boolean) {
    dismissSavedNotice();
    savedNotice = enabledChanged ? "restart" : "saved";
    savedNoticeTimer = setTimeout(() => {
      savedNotice = false;
      savedNoticeTimer = undefined;
    }, 8000);
  }

  async function handleSave() {
    dismissSavedNotice();
    await onSave();
    showSavedNotice(enabledToggled);
    enabledToggled = false;
  }

  function handleTest() {
    dismissSavedNotice();
    void onTest();
  }

  function handleFieldInput() {
    dismissSavedNotice();
  }

  function handleToggleEnabled() {
    dismissSavedNotice();
    enabledToggled = true;
  }
</script>

<section class="integration-panel">
  <div class="panel-header">
    <h3>{$t.settingsSlackTitle}</h3>
    <label class="toggle">
      <input type="checkbox" bind:checked={config.enabled} onchange={handleToggleEnabled} />
      {$t.settingsSlackEnabled}
    </label>
  </div>

  {#if savedNotice === "restart"}
    <p class="status ok">{$t.settingsSlackRestart}</p>
  {:else if savedNotice === "saved"}
    <p class="status ok">{$t.settingsSlackSaved}</p>
  {/if}

  {#if config.enabled}
    <p class="hint">
      {$t.settingsSlackExtractHint}
      <a href="https://github.com/maorfr/slack-token-extractor" target="_blank" rel="noopener noreferrer">
        slack-token-extractor
      </a>
    </p>
    <label class="field">
      <span>{$t.settingsSlackToken}</span>
      <input
        type={showSecrets ? "text" : "password"}
        bind:value={config.token}
        oninput={handleFieldInput}
        spellcheck="false"
        placeholder="xoxc-..."
      />
    </label>
    <label class="field">
      <span>{$t.settingsSlackCookie}</span>
      <input
        type={showSecrets ? "text" : "password"}
        bind:value={config.cookie}
        oninput={handleFieldInput}
        spellcheck="false"
        placeholder="xoxd-..."
      />
    </label>
    <button type="button" class="link" onclick={() => onToggleShowSecrets(!showSecrets)}>
      {showSecrets ? $t.settingsSlackHideSecrets : $t.settingsSlackShowSecrets}
    </button>

    <div class="actions">
      <button type="button" class="secondary" onclick={handleTest} disabled={testing}>
        {testing ? $t.settingsSlackTesting : $t.settingsSlackTestConnection}
      </button>
      <button type="button" class="primary" onclick={handleSave}>
        {$t.settingsSlackSave}
      </button>
    </div>

    {#if testStatus === "ok"}
      <p class="status ok">{$t.settingsSlackStatusConnected}</p>
    {:else if testStatus === "error" && testError}
      <p class="status error">{testError}</p>
    {/if}
  {/if}

  {#if !config.enabled}
    <div class="actions">
      <button type="button" class="primary" onclick={handleSave}>
        {$t.settingsSlackSave}
      </button>
    </div>
  {/if}
</section>

<style>
  .integration-panel {
    display: grid;
    gap: 12px;
  }
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  h3 {
    margin: 0;
    font-size: 1rem;
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--muted);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .field span {
    font-size: 13px;
    color: var(--muted);
  }
  .field input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-secondary);
    color: var(--fg);
    font-size: 14px;
  }
  .hint {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
    line-height: 1.4;
  }
  .hint a {
    color: var(--accent);
  }
  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  button.primary,
  button.secondary {
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 14px;
    cursor: pointer;
  }
  button.primary {
    border: none;
    background: var(--accent);
    color: var(--accent-fg);
  }
  button.secondary {
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--fg);
  }
  button.link {
    border: none;
    background: transparent;
    color: var(--muted);
    font-size: 13px;
    cursor: pointer;
    text-decoration: underline;
    padding: 0;
    justify-self: start;
  }
  .status {
    margin: 0;
    font-size: 13px;
    border-radius: 8px;
    padding: 8px 12px;
  }
  .status.ok {
    background: color-mix(in srgb, var(--success) 15%, transparent);
    color: var(--success);
  }
  .status.error {
    background: var(--error-bg);
    color: var(--error-fg);
  }
</style>
