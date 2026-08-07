<script lang="ts">
  import type { ChatController } from "./chat-controller";
  import { resolveInputKey } from "./keyboard";
  import { t } from "./i18n";
  import { tick } from "svelte";
  import { autoResizeTextarea, sendAndResetTextarea } from "./input-bar";

  let {
    controller,
    budgetBlocked = false,
    onAbort,
    onSent,
  }: {
    controller: ChatController;
    budgetBlocked?: boolean;
    onAbort: () => void;
    onSent?: () => void;
  } = $props();

  const input = $derived(controller.input);
  const attachments = $derived(controller.attachments);
  const attachmentErrors = $derived(controller.attachmentErrors);
  const rejectionReasons = $derived(controller.attachmentRejectionReasons);
  const inputDisabled = $derived(controller.inputDisabled);
  const canSend = $derived(controller.canSend);
  const showAbort = $derived(controller.showAbort);
  const canSendNow = $derived($canSend && !budgetBlocked);
  const inputLocked = $derived($inputDisabled || budgetBlocked);

  let textarea: HTMLTextAreaElement | undefined = $state();

  function autoResize() {
    autoResizeTextarea(textarea ?? undefined);
  }

  async function sendNow() {
    // `tick` lets Svelte apply the cleared value before the height is reset;
    // otherwise `height: auto` measures the text that is still on screen.
    await sendAndResetTextarea(() => controller.send(), textarea, tick);
    onSent?.();
  }

  async function handleKeydown(event: KeyboardEvent) {
    const action = resolveInputKey(event);
    if (action === "send") {
      event.preventDefault();
      await sendNow();
    }
  }

  async function pickFiles() {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ multiple: true });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      controller.addAttachments(paths);
    } catch {
      // Not in Tauri or dialog unavailable — no-op in browser dev.
    }
  }
</script>

<div class="input-bar">
  {#if budgetBlocked}
    <p class="budget-blocked" role="status">{$t.budgetBlockedMessage}</p>
  {/if}
  <div class="input-capsule">
    {#if $rejectionReasons.length > 0}
      <div class="attachment-errors" role="alert">
        {#each $rejectionReasons as entry (entry.name)}
          <span>{entry.reason === "spreadsheet" ? $t.unsupportedSpreadsheet : entry.reason === "document" ? $t.unsupportedDocument : $t.unsupportedFormat}: {entry.name}</span>
        {/each}
      </div>
    {/if}
    {#if $attachments.length > 0}
      <div class="attachment-chips">
        {#each $attachments as file (file.path)}
          <span class="chip">
            <span class="chip-name">{file.name}</span>
            <button
              type="button"
              class="chip-remove"
              onclick={() => controller.removeAttachment(file.path)}
              title={$t.removeAttachmentTitle}
            >
              ×
            </button>
          </span>
        {/each}
      </div>
    {/if}
    <textarea
      bind:this={textarea}
      bind:value={$input}
      onkeydown={handleKeydown}
      oninput={autoResize}
      disabled={inputLocked}
      placeholder={$t.inputPlaceholder}
      rows="1"
    ></textarea>
    <div class="button-row">
      <button
        type="button"
        class="attach"
        onclick={pickFiles}
        disabled={inputLocked}
        title={$t.attachTitle}
      >
        📎
      </button>
      {#if $showAbort}
        <button class="abort" onclick={onAbort} title={$t.abortTitle}>◼</button>
      {:else}
        <button class="send" onclick={sendNow} disabled={!canSendNow} title={$t.sendTitle}>↑</button>
      {/if}
    </div>
  </div>
</div>

<style>
  .input-bar {
    padding: 12px;
    background: var(--bg);
  }
  .budget-blocked {
    margin: 0 0 8px;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--error-bg);
    color: var(--error-fg);
    font-size: 13px;
  }
  .input-capsule {
    display: flex;
    flex-direction: column;
    gap: 6px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--bg-secondary);
    padding: 10px 14px;
  }
  .input-capsule:focus-within {
    border-color: var(--accent);
  }
  .button-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .attachment-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 8px;
    background: var(--bg-secondary);
    font-size: 13px;
  }
  .chip-remove {
    border: none;
    background: transparent;
    cursor: pointer;
    padding: 0 2px;
    font-size: 14px;
    line-height: 1;
    color: inherit;
    width: auto;
    height: auto;
  }
  .attachment-errors {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 8px;
    background: var(--error-bg);
    color: var(--error-fg);
    font-size: 13px;
  }
  textarea {
    width: 100%;
    resize: none;
    border: none;
    background: transparent;
    padding: 4px 0;
    font: inherit;
    color: var(--fg);
    outline: none;
    min-height: 24px;
    max-height: 160px;
    box-sizing: border-box;
  }
  textarea:disabled {
    opacity: 0.6;
  }
  button.attach,
  button.send,
  button.abort {
    border: none;
    cursor: pointer;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  button.attach {
    background: transparent;
    color: var(--muted);
    width: 32px;
    height: 32px;
    border-radius: 8px;
    font-size: 16px;
  }
  button.attach:hover:not(:disabled) {
    color: var(--fg);
    background: var(--bg);
  }
  button.send {
    background: var(--accent);
    color: var(--accent-fg);
    width: 32px;
    height: 32px;
    border-radius: 50%;
    font-size: 16px;
  }
  button.abort {
    background: var(--abort);
    color: #fff;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    font-size: 14px;
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
