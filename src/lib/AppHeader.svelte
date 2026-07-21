<script lang="ts">
  import AboutPanel from "./AboutPanel.svelte";
  import { t } from "./i18n";

  let {
    onEndSession,
    aboutOpen = false,
    onAboutToggle,
    aboutVersion,
    aboutDirectory,
    aboutModel,
    aboutTurns,
  }: {
    onEndSession: () => void;
    aboutOpen?: boolean;
    onAboutToggle: () => void;
    aboutVersion: string;
    aboutDirectory: string;
    aboutModel: string;
    aboutTurns: number;
  } = $props();
</script>

<header class="app-header">
  <span class="app-name">Buddy</span>
  <div class="actions">
    <button
      type="button"
      class="icon-btn"
      onclick={onAboutToggle}
      title={$t.headerAbout}
      aria-label={$t.headerAbout}
      aria-expanded={aboutOpen}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2" />
        <path d="M12 10v6M12 7h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
    </button>
    <button
      type="button"
      class="icon-btn end-session"
      onclick={onEndSession}
      title={$t.headerEndSession}
      aria-label={$t.headerEndSession}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          d="M12 2v10M8.5 8.5 12 12l3.5-3.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  </div>
  {#if aboutOpen}
    <AboutPanel
      version={aboutVersion}
      abDirectory={aboutDirectory}
      model={aboutModel}
      turns={aboutTurns}
      onClose={onAboutToggle}
    />
  {/if}
</header>

<style>
  .app-header {
    position: relative;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 40px;
    padding: 0 12px;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
  }
  .app-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--muted);
    letter-spacing: 0.02em;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }
  .icon-btn:hover {
    background: var(--bg-secondary);
    color: var(--fg);
  }
  .end-session:hover {
    color: var(--abort);
  }
</style>
