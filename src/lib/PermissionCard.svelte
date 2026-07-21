<script lang="ts">
  // Inline permission prompt (FR-PERM-07): user-friendly description of what
  // the agent wants to do, without exposing file paths for identity writes.
  import { get } from "svelte/store";
  import type { AllowedPathPersist } from "../../shared/api";
  import { dirname } from "../utils/path";
  import { t } from "./i18n";
  import type { PermissionCard } from "./chat-controller";

  let {
    card,
    onRespond,
    onDismiss,
  }: {
    card: PermissionCard;
    onRespond: (id: number, allow: boolean, persist?: AllowedPathPersist) => void;
    onDismiss: (id: number) => void;
  } = $props();

  let expanded = $state(false);

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
  const showPersistentOptions = $derived(card.request.kind === "outside");

  function dismiss() {
    onDismiss(card.request.id);
  }

  function allowOnce() {
    onRespond(card.request.id, true);
  }

  function allowFileAlways() {
    onRespond(card.request.id, true, { path: card.request.path, type: "file" });
  }

  function allowFolderAlways() {
    onRespond(card.request.id, true, {
      path: dirname(card.request.path),
      type: "directory",
    });
  }
</script>

<div class="permission-card" class:resolved={card.verdict !== undefined} class:collapsed={card.verdict !== undefined && !expanded}>
  {#if card.verdict !== undefined && !expanded}
    <div class="collapsed-row">
      <span class="collapsed-text">
        <span class="badge" class:badge-allowed={card.verdict === "allowed"} class:badge-denied={card.verdict === "denied"}>
          {card.verdict === "allowed" ? "✓" : "✗"}
        </span>
        {opLabel} · <code>{showPath ? card.request.path.split("/").slice(-2).join("/") : "SOUL.md"}</code>
        — {card.verdict === "allowed" ? strings.permissionAllowed : strings.permissionDenied}
      </span>
      <button class="expand-btn" onclick={() => (expanded = true)} title="expand">⋯</button>
      <button class="dismiss-btn" onclick={dismiss} title="dismiss">×</button>
    </div>
  {:else}
    <p class="title">{title}</p>
    {#if showPath}
      <p class="detail"><strong>{opLabel}</strong> · <code>{card.request.path}</code></p>
    {/if}
    {#if card.verdict === undefined}
      <div class="actions">
        <button class="allow" onclick={allowOnce}>
          {strings.permissionAllowOnce}
        </button>
        {#if showPersistentOptions}
          <button class="secondary" onclick={allowFileAlways}>
            {strings.permissionAllowAlwaysFile}
          </button>
          <button class="secondary" onclick={allowFolderAlways}>
            {strings.permissionAllowAlwaysFolder}
          </button>
        {/if}
        <button class="deny" onclick={() => onRespond(card.request.id, false)}>
          {strings.permissionDeny}
        </button>
      </div>
    {:else}
      <div class="resolved-row">
        <p class="verdict">{card.verdict === "allowed" ? strings.permissionAllowed : strings.permissionDenied}</p>
        <button class="dismiss-btn" onclick={dismiss} title="dismiss">×</button>
      </div>
    {/if}
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
    transition: padding 0.2s, margin 0.2s;
  }
  .permission-card.resolved {
    opacity: 0.85;
  }
  .permission-card.collapsed {
    padding: 6px 12px;
    margin: 4px 16px;
    border-radius: 8px;
  }
  .collapsed-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--muted);
  }
  .collapsed-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .collapsed-text code {
    font-size: 11px;
  }
  .badge {
    display: inline-block;
    width: 16px;
    height: 16px;
    line-height: 16px;
    text-align: center;
    border-radius: 50%;
    font-size: 10px;
    font-weight: 700;
    margin-right: 4px;
    vertical-align: middle;
  }
  .badge-allowed {
    background: #059669;
    color: #fff;
  }
  .badge-denied {
    background: var(--abort, #ef4444);
    color: #fff;
  }
  .expand-btn,
  .dismiss-btn {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    font-size: 14px;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .expand-btn:hover,
  .dismiss-btn:hover {
    background: var(--border);
    color: var(--fg);
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
    flex-wrap: wrap;
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
  .actions button.secondary {
    color: var(--muted);
  }
  .actions button.deny {
    border-color: var(--abort);
    color: var(--abort);
  }
  .resolved-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .verdict {
    margin-top: 8px;
    font-size: 13px;
    color: var(--muted);
  }
</style>
