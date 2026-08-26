<script lang="ts">
  import { t } from "./i18n";
  import { providerLabel } from "./settings-controller";
  import type { AuthErrorCard } from "./chat-controller";

  let {
    card,
    onOpenSettings,
    onDismiss,
  }: {
    card: AuthErrorCard;
    onOpenSettings: () => void;
    onDismiss: () => void;
  } = $props();
</script>

<div class="auth-error-card" role="alert">
  <p class="title">{$t.authErrorCardTitle}</p>
  <p class="detail">
    {$t.authErrorCardBody.replace("{provider}", providerLabel(card.provider, $t))}
  </p>
  <div class="actions">
    <button type="button" class="primary" onclick={onOpenSettings}>
      {$t.authErrorCardOpenSettings}
    </button>
    <button type="button" class="dismiss" onclick={onDismiss} title={$t.authErrorCardDismiss}>
      ×
    </button>
  </div>
</div>

<style>
  .auth-error-card {
    margin: 8px 16px;
    padding: 12px 16px;
    border: 1px solid var(--border);
    border-left: 3px solid var(--abort);
    border-radius: 10px;
    background: var(--bg-secondary);
    font-size: 14px;
  }
  .title {
    font-weight: 600;
    margin-bottom: 6px;
    color: var(--abort);
  }
  .detail {
    margin-bottom: 10px;
    color: var(--fg);
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .actions button.primary {
    border: none;
    border-radius: 8px;
    padding: 6px 14px;
    cursor: pointer;
    font-size: 13px;
    background: var(--accent);
    color: var(--accent-fg);
  }
  .actions button.dismiss {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    font-size: 18px;
    padding: 2px 8px;
    border-radius: 4px;
  }
  .actions button.dismiss:hover {
    background: var(--border);
    color: var(--fg);
  }
</style>
