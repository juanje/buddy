<script lang="ts">
  import type { ConnectorConfig } from "../../shared/api";
  import {
    parseProjectPrefixInput,
    patternsToDisplayText,
  } from "../../shared/jira-patterns";
  import { t } from "./i18n";

  let {
    config = $bindable<ConnectorConfig>({
      enabled: true,
      baseUrl: "",
      email: "",
      token: "",
      issueKeyPatterns: [],
    }),
    testing = false,
    testStatus = "idle" as "idle" | "ok" | "error",
    testError = undefined as string | undefined,
    showToken = false,
    onSave,
    onTest,
    onToggleShowToken,
  }: {
    config?: ConnectorConfig;
    testing?: boolean;
    testStatus?: "idle" | "ok" | "error";
    testError?: string | undefined;
    showToken?: boolean;
    onSave: () => void | Promise<void>;
    onTest: () => void | Promise<void>;
    onToggleShowToken: (show: boolean) => void;
  } = $props();

  let patternsText = $state(patternsToDisplayText(config.issueKeyPatterns ?? []));
  let savedNotice = $state<"saved" | "restart" | false>(false);
  let savedNoticeTimer: ReturnType<typeof setTimeout> | undefined;
  let enabledToggled = $state(false);

  $effect(() => {
    patternsText = patternsToDisplayText(config.issueKeyPatterns ?? []);
  });

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

  function onPatternsInput(value: string) {
    dismissSavedNotice();
    patternsText = value;
    config.issueKeyPatterns = parseProjectPrefixInput(value);
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
    <h3>{$t.settingsJiraTitle}</h3>
    <label class="toggle">
      <input type="checkbox" bind:checked={config.enabled} onchange={handleToggleEnabled} />
      {$t.settingsJiraEnabled}
    </label>
  </div>

  {#if savedNotice === "restart"}
    <p class="status ok">{$t.settingsJiraRestart}</p>
  {:else if savedNotice === "saved"}
    <p class="status ok">{$t.settingsJiraSaved}</p>
  {/if}

  {#if config.enabled}
    <label class="field">
      <span>{$t.settingsJiraBaseUrl}</span>
      <input
        type="text"
        bind:value={config.baseUrl}
        oninput={handleFieldInput}
        spellcheck="false"
        placeholder="https://your-org.atlassian.net"
      />
    </label>
    <label class="field">
      <span>{$t.settingsJiraEmail}</span>
      <input type="email" bind:value={config.email} oninput={handleFieldInput} spellcheck="false" />
    </label>
    <label class="field">
      <span>{$t.settingsJiraToken}</span>
      <input
        type={showToken ? "text" : "password"}
        bind:value={config.token}
        oninput={handleFieldInput}
        spellcheck="false"
      />
    </label>
    <button type="button" class="link" onclick={() => onToggleShowToken(!showToken)}>
      {showToken ? $t.settingsJiraHideToken : $t.settingsJiraShowToken}
    </button>
    <label class="field">
      <span>{$t.settingsJiraKeyPatterns}</span>
      <input
        type="text"
        value={patternsText}
        oninput={(e) => onPatternsInput(e.currentTarget.value)}
        spellcheck="false"
        placeholder="PROJ, TEAM"
      />
    </label>
    <label class="field">
      <span>{$t.settingsJiraBoardId}</span>
      <input
        type="text"
        bind:value={config.boardId}
        oninput={handleFieldInput}
        spellcheck="false"
        placeholder="12345"
      />
      <span class="hint">{$t.settingsJiraBoardIdHint}</span>
    </label>

    <div class="actions">
      <button type="button" class="secondary" onclick={handleTest} disabled={testing}>
        {testing ? $t.settingsJiraTesting : $t.settingsJiraTestConnection}
      </button>
      <button type="button" class="primary" onclick={handleSave}>
        {$t.settingsJiraSave}
      </button>
    </div>

    {#if testStatus === "ok"}
      <p class="status ok">{$t.settingsJiraStatusConnected}</p>
    {:else if testStatus === "error" && testError}
      <p class="status error">{testError}</p>
    {/if}
  {/if}

  {#if !config.enabled}
    <div class="actions">
      <button type="button" class="primary" onclick={handleSave}>
        {$t.settingsJiraSave}
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
  .field .hint {
    font-size: 12px;
    color: var(--muted);
    line-height: 1.4;
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
