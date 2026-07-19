<script lang="ts">
  import type { ChatController } from "./chat-controller";
  import { resolveInputKey } from "./keyboard";
  import { t } from "./i18n";

  let {
    controller,
    onAbort,
    onSent,
  }: { controller: ChatController; onAbort: () => void; onSent?: () => void } = $props();

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
    // "newline": default textarea behavior inserts it
  }

  function autoResize() {
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 160) + "px";
  }
</script>

<div class="input-bar">
  <textarea
    bind:this={textarea}
    bind:value={$controller.input}
    onkeydown={handleKeydown}
    oninput={autoResize}
    disabled={$controller.inputDisabled}
    placeholder={t.inputPlaceholder}
    rows="1"
  ></textarea>
  {#if $controller.showAbort}
    <button class="abort" onclick={onAbort} title={t.abortTitle}>◼</button>
  {:else}
    <button class="send" onclick={sendNow} disabled={!$controller.canSend} title={t.sendTitle}>
      ➤
    </button>
  {/if}
</div>

<style>
  .input-bar {
    display: flex;
    gap: 8px;
    padding: 12px;
    border-top: 1px solid var(--border);
    background: var(--bg);
    align-items: flex-end;
  }
  textarea {
    flex: 1;
    resize: none;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 12px;
    font: inherit;
    background: var(--bg);
    color: var(--fg);
    outline: none;
    max-height: 160px;
  }
  textarea:focus {
    border-color: var(--accent);
  }
  textarea:disabled {
    opacity: 0.6;
  }
  button {
    border: none;
    border-radius: 10px;
    width: 40px;
    height: 40px;
    font-size: 16px;
    cursor: pointer;
    background: var(--accent);
    color: var(--accent-fg);
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  button.abort {
    background: #dc2626;
    color: #fff;
  }
</style>
