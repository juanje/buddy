<script lang="ts">
  // Setup wizard shell (FR-SETUP-01: shown instead of chat on first run).
  // The actual steps (prerequisites, location, provider, model) arrive with
  // FR-SETUP-02..05; this shell is the routing target they will fill.
  import { t } from "./i18n";
</script>

<div class="wizard">
  <h1>{t.wizardTitle}</h1>
  <p>{t.wizardIntro}</p>
  <p class="muted">{t.wizardComingSoon}</p>
</div>

<style>
  .wizard {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 12px;
    padding: 32px;
    text-align: center;
  }
  .wizard h1 {
    font-size: 24px;
  }
  .wizard p {
    max-width: 480px;
    line-height: 1.5;
  }
  .muted {
    color: var(--muted);
    font-size: 13px;
  }
</style>
