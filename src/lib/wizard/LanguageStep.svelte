<script lang="ts">
  import { setLocale, t, type AppLocale } from "../i18n";

  let { onSelect }: { onSelect: (lang: AppLocale) => void } = $props();

  function pick(lang: AppLocale) {
    setLocale(lang);
    onSelect(lang);
  }
</script>

<h2>{$t.languageTitle}</h2>
<div class="languages">
  <button class="lang-card" onclick={() => pick("es")}>{$t.languageOptionEs}</button>
  <button class="lang-card" onclick={() => pick("en")}>{$t.languageOptionEn}</button>
</div>

<style>
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
    border-color: var(--accent, #4f46e5);
  }
</style>
