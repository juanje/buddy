<script lang="ts">
  import type { ConnectorConfig } from "../../shared/api";
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

  let patternsText = $state((config.issueKeyPatterns ?? []).join(", "));

  $effect(() => {
    patternsText = (config.issueKeyPatterns ?? []).join(", ");
  });

  function onPatternsInput(value: string) {
    patternsText = value;
    config.issueKeyPatterns = value
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
  }
</script>

<section class="integration-panel">
  <div class="panel-header">
    <h3>{$t.settingsJiraTitle}</h3>
    <label class="toggle">
      <input type="checkbox" bind:checked={config.enabled} />
      {$t.settingsJiraEnabled}
    </label>
  </div>

  {#if config.enabled}
    <label class="field">
      <span>{$t.settingsJiraBaseUrl}</span>
      <input type="text" bind:value={config.baseUrl} spellcheck="false" placeholder="https://your-org.atlassian.net" />
    </label>
    <label class="field">
      <span>{$t.settingsJiraEmail}</span>
      <input type="email" bind:value={config.email} spellcheck="false" />
    </label>
    <label class="field">
      <span>{$t.settingsJiraToken}</span>
      <input type={showToken ? "text" : "password"} bind:value={config.token} spellcheck="false" />
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
        placeholder="PROJ-\\d+"
      />
    </label>

    <div class="actions">
      <button type="button" class="secondary" onclick={onTest} disabled={testing}>
        {testing ? $t.settingsJiraTesting : $t.settingsJiraTestConnection}
      </button>
      <button type="button" class="primary" onclick={onSave}>
        {$t.settingsJiraSave}
      </button>
    </div>

    {#if testStatus === "ok"}
      <p class="status ok">{$t.settingsJiraStatusConnected}</p>
    {:else if testStatus === "error" && testError}
      <p class="status error">{testError}</p>
    {/if}

    <p class="hint">{$t.settingsJiraNextSessionNotice}</p>
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
  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }
</style>
