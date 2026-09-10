<script lang="ts">
  import { onMount } from "svelte";
  import { t } from "./i18n";
  import { NEW_TOPIC_BUTTON_CLASS } from "./new-topic-contract";

  let {
    disabled = false,
    onStartNow,
    onWrapUp,
  }: {
    disabled?: boolean;
    onStartNow: () => void;
    onWrapUp: () => void;
  } = $props();

  let open = $state(false);
  let rootEl: HTMLDivElement | undefined = $state();

  function close(): void {
    open = false;
  }

  function toggle(): void {
    if (disabled) return;
    open = !open;
  }

  function handleStartNow(): void {
    close();
    onStartNow();
  }

  function handleWrapUp(): void {
    close();
    onWrapUp();
  }

  function handleDocumentPointer(event: PointerEvent): void {
    if (!open || !rootEl) return;
    if (!rootEl.contains(event.target as Node)) close();
  }

  function handleDocumentKeydown(event: KeyboardEvent): void {
    if (!open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  onMount(() => {
    document.addEventListener("pointerdown", handleDocumentPointer);
    document.addEventListener("keydown", handleDocumentKeydown);
    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointer);
      document.removeEventListener("keydown", handleDocumentKeydown);
    };
  });
</script>

<div class="new-topic-root" bind:this={rootEl}>
  <button
    type="button"
    class={NEW_TOPIC_BUTTON_CLASS}
    onclick={toggle}
    {disabled}
    aria-haspopup="menu"
    aria-expanded={open}
  >
    {$t.newTopicButton}
  </button>
  {#if open}
    <div class="popover" role="menu">
      <button type="button" class="option" role="menuitem" onclick={handleStartNow}>
        {$t.startNow}
      </button>
      <button type="button" class="option" role="menuitem" onclick={handleWrapUp}>
        {$t.wrapUpFirst}
      </button>
    </div>
  {/if}
</div>

<style>
  .new-topic-root {
    position: relative;
    display: flex;
    align-items: center;
  }
  .new-topic-button {
    border: none;
    background: transparent;
    color: var(--muted);
    padding: 4px 8px;
    font-size: 12px;
    cursor: pointer;
    line-height: 1.2;
  }
  .new-topic-button:hover:not(:disabled) {
    color: var(--fg);
    background: color-mix(in srgb, var(--fg) 6%, transparent);
    border-radius: 6px;
  }
  .new-topic-button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .popover {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 160px;
    padding: 6px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    z-index: 20;
  }
  .option {
    border: none;
    background: transparent;
    color: var(--fg);
    padding: 8px 10px;
    font-size: 13px;
    text-align: left;
    border-radius: 6px;
    cursor: pointer;
    width: 100%;
  }
  .option:hover:not(:disabled) {
    background: var(--bg-secondary);
  }
</style>
