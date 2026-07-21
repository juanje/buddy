<script lang="ts">
  import type { ChatController } from "./chat-controller";
  import { resolveInputKey } from "./keyboard";
  import { t } from "./i18n";

  let {
    controller,
    onAbort,
    onSent,
  }: { controller: ChatController; onAbort: () => void; onSent?: () => void } = $props();

  const input = $derived(controller.input);
  const attachments = $derived(controller.attachments);
  const attachmentErrors = $derived(controller.attachmentErrors);
  const inputDisabled = $derived(controller.inputDisabled);
  const canSend = $derived(controller.canSend);
  const showAbort = $derived(controller.showAbort);

  let textarea: HTMLTextAreaElement | undefined = $state();

  async function sendNow() {
    await controller.send();
    onSent?.();
  }

  async function handleKeydown(event: KeyboardEvent) {
    const action = resolveInputKey(event);
    if (action === "send") {
      event.preventDefault();
      await sendNow();
    }
  }

  function autoResize() {
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 160) + "px";
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
  <div class="input-column">
    {#if $attachmentErrors.length > 0}
      <div class="attachment-errors" role="alert">
        {#each $attachmentErrors as name (name)}
          <span>{$t.unsupportedFormat}: {name}</span>
        {/each}
        <button type="button" class="dismiss-errors" onclick={() => controller.clearAttachmentErrors()}>
          ×
        </button>
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
              title="Remove"
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
      disabled={$inputDisabled}
      placeholder={$t.inputPlaceholder}
      rows="1"
    ></textarea>
    <div class="button-row">
      <button
        type="button"
        class="attach"
        onclick={pickFiles}
        disabled={$inputDisabled}
        title={$t.attachTitle}
      >
        📎
      </button>
      {#if $showAbort}
        <button class="abort" onclick={onAbort} title={$t.abortTitle}>◼</button>
      {:else}
        <button class="send" onclick={sendNow} disabled={!$canSend} title={$t.sendTitle}>↑</button>
      {/if}
    </div>
  </div>
</div>

<style>
  .input-bar {
    padding: 12px;
    border-top: 1px solid var(--border);
    background: var(--bg);
  }
  .input-column {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .button-row {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
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
    background: var(--chip-bg, rgba(127, 127, 127, 0.15));
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
  .dismiss-errors {
    margin-left: auto;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    width: auto;
    height: auto;
    padding: 0 4px;
  }
  textarea {
    width: 100%;
    resize: none;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 9px 12px;
    font: inherit;
    background: var(--bg);
    color: var(--fg);
    outline: none;
    min-height: 40px;
    max-height: 160px;
    box-sizing: border-box;
  }
  textarea:focus {
    border-color: var(--accent);
  }
  textarea:disabled {
    opacity: 0.6;
  }
  button.attach,
  button.send,
  button.abort {
    border: none;
    border-radius: 10px;
    width: 40px;
    height: 40px;
    font-size: 16px;
    cursor: pointer;
    flex-shrink: 0;
  }
  button.attach {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--fg);
  }
  button.send {
    background: var(--accent);
    color: var(--accent-fg);
  }
  button.abort {
    background: var(--abort);
    color: #fff;
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
