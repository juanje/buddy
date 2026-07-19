<script lang="ts">
  // Inline permission prompt (FR-PERM-07): user-friendly description of what
  // the agent wants to do, without exposing file paths for identity writes.
  import { get } from "svelte/store";
  import { t } from "./i18n";
  import type { PermissionCard } from "./chat-controller";

  let {
    card,
    onRespond,
  }: { card: PermissionCard; onRespond: (id: number, allow: boolean) => void } = $props();

  const strings = $derived(get(t));
  const title = $derived(
    card.request.kind === "identity-write"
      ? strings.permissionTitleIdentity
      : strings.permissionTitleOutside,
  );
  const opLabel = $derived(
    card.request.op === "write" ? strings.permissionOpWrite : strings.permissionOpRead,
  );
  const showPath = $derived(card.request.kind !== "identity-write");
</script>

<div class="permission-card" class:resolved={card.verdict !== undefined}>
  <p class="title">{title}</p>
  {#if showPath}
    <p class="detail"><strong>{opLabel}</strong> · <code>{card.request.path}</code></p>
  {/if}
  {#if card.verdict === undefined}
    <div class="actions">
      <button class="allow" onclick={() => onRespond(card.request.id, true)}>
        {strings.permissionAllowOnce}
      </button>
      <button class="deny" onclick={() => onRespond(card.request.id, false)}>
        {strings.permissionDeny}
      </button>
    </div>
  {:else}
    <p class="verdict">{card.verdict === "allowed" ? strings.permissionAllowed : strings.permissionDenied}</p>
  {/if}
</div>

<style>
  .permission-card {
    margin: 8px 16px;
    padding: 12px 16px;
    border: 1px solid var(--border);
    border-left: 3px solid var(--accent, #4f46e5);
    border-radius: 10px;
    background: var(--bg-secondary);
    font-size: 14px;
  }
  .permission-card.resolved {
    opacity: 0.7;
  }
  .title {
    font-weight: 600;
    margin-bottom: 6px;
  }
  .detail code {
    font-size: 12px;
    word-break: break-all;
  }
  .actions {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }
  .actions button {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 6px 14px;
    cursor: pointer;
    font-size: 13px;
    background: var(--bg-secondary);
    color: var(--fg);
  }
  .actions button.allow {
    background: var(--accent, #4f46e5);
    border-color: transparent;
    color: #fff;
  }
  .actions button.deny {
    border-color: var(--abort);
    color: var(--abort);
  }
  .verdict {
    margin-top: 8px;
    font-size: 13px;
    color: var(--muted);
  }
</style>
