<script lang="ts">
  import { t } from "./i18n";

  let {
    version,
    abDirectory,
    model,
    turns,
    onClose,
  }: {
    version: string;
    abDirectory: string;
    model: string;
    turns: number;
    onClose: () => void;
  } = $props();
</script>

<div class="about-panel" role="dialog" aria-labelledby="about-title">
  <div class="about-header">
    <h2 id="about-title">{$t.aboutTitle}</h2>
    <button type="button" class="close-btn" onclick={onClose} title={$t.aboutClose} aria-label={$t.aboutClose}>
      ×
    </button>
  </div>
  <dl class="about-rows">
    <div class="row">
      <dt>{$t.aboutVersion}</dt>
      <dd>{version}</dd>
    </div>
    <div class="row">
      <dt>{$t.aboutDirectory}</dt>
      <dd class="mono" title={abDirectory}>{abDirectory}</dd>
    </div>
    <div class="row">
      <dt>{$t.aboutModel}</dt>
      <dd>{model}</dd>
    </div>
    <div class="row">
      <dt>{$t.aboutTurns}</dt>
      <dd>{turns}</dd>
    </div>
  </dl>
</div>

<style>
  .about-panel {
    position: absolute;
    top: calc(100% + 4px);
    right: 12px;
    z-index: 20;
    width: min(360px, calc(100vw - 24px));
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  }
  .about-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
  }
  h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }
  .close-btn {
    border: none;
    background: transparent;
    color: var(--muted);
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    padding: 0 4px;
    border-radius: 4px;
  }
  .close-btn:hover {
    background: var(--bg-secondary);
    color: var(--fg);
  }
  .about-rows {
    margin: 0;
  }
  .row {
    display: grid;
    grid-template-columns: 110px 1fr;
    gap: 8px;
    padding: 6px 0;
    border-top: 1px solid var(--border);
  }
  .row:first-child {
    border-top: none;
    padding-top: 0;
  }
  dt {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
  }
  dd {
    margin: 0;
    font-size: 13px;
    word-break: break-all;
  }
  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
  }
</style>
