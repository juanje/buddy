<script lang="ts">
  import { setLocale, type AppLocale } from "../i18n";

  let { onSelect }: { onSelect: (lang: AppLocale) => void } = $props();

  function pick(lang: AppLocale) {
    setLocale(lang);
    onSelect(lang);
  }
</script>

<h2 class="bilingual">Choose your language<br /><span class="secondary">Elige tu idioma</span></h2>
<div class="languages">
  <button class="lang-card" onclick={() => pick("es")}>Español</button>
  <button class="lang-card" onclick={() => pick("en")}>English</button>
</div>

<style>
  .bilingual {
    text-align: center;
    line-height: 1.6;
  }
  .secondary {
    font-size: 0.85em;
    opacity: 0.7;
    font-weight: normal;
  }
  .languages {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .lang-card {
    min-width: 140px;
    padding: 16px 24px;
    font-size: 16px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--fg);
    border-radius: 12px;
    cursor: pointer;
  }
  .lang-card:hover {
    border-color: var(--accent);
  }
</style>
