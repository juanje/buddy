<script lang="ts">
  import type { ChatController } from "./chat-controller";
  import { resolveInputKey } from "./keyboard";

  let { controller, onAbort }: { controller: ChatController; onAbort: () => void } = $props();

  const { input, inputDisabled, canSend, showAbort } = controller;

  let textarea: HTMLTextAreaElement | undefined = $state();

  async function handleKeydown(event: KeyboardEvent) {
    const action = resolveInputKey(event);
    if (action === "send") {
      event.preventDefault();
      await controller.send();
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
    bind:value={$input}
    onkeydown={handleKeydown}
    oninput={autoResize}
    disabled={$inputDisabled}
    placeholder="Escribe un mensaje…"
    rows="1"
  ></textarea>
  {#if $showAbort}
    <button class="abort" onclick={onAbort} title="Abort (Esc)">◼</button>
  {:else}
    <button class="send" onclick={() => controller.send()} disabled={!$canSend} title="Send (Enter)">
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
