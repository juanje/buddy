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
  <div class="spacer"></div>
  <div class="actions">
    <button
      type="button"
      class="icon-btn"
      onclick={onAboutToggle}
      title={$t.headerAbout}
      aria-label={$t.headerAbout}
      aria-expanded={aboutOpen}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.75" />
        <path d="M12 11v5M12 7.5h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
    </button>
    <button
      type="button"
      class="icon-btn end-session"
      onclick={onEndSession}
      title={$t.headerEndSession}
      aria-label={$t.headerEndSession}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
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
    justify-content: flex-end;
    height: 40px;
    padding: 0 12px;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
  }
  .spacer {
    flex: 1;
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
