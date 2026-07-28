<script lang="ts">
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import type { FileViewerController } from "./file-viewer-controller";
  import { renderMarkdown } from "./markdown";
  import { t } from "./i18n";

  let { controller }: { controller: FileViewerController } = $props();

  const open = $derived(controller.open);
  const filePath = $derived(controller.filePath);
  const fileName = $derived(controller.fileName);
  const content = $derived(controller.content);
  const error = $derived(controller.error);
  const isMarkdown = $derived(controller.isMarkdown);
  const loading = $derived(controller.loading);

  const canGoBack = $derived(controller.canGoBack);

  function onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      controller.close();
    }
  }

  /**
   * Follow links inside the rendered document (FR-CHAT-12). Same delegation the
   * chat uses; the controller resolves the target relative to the open document
   * and refuses anything out of bounds.
   */
  function onContentClick(event: MouseEvent) {
    const anchor = (event.target as HTMLElement).closest("a[data-local-path]");
    if (!anchor) return;
    event.preventDefault();
    const href = anchor.getAttribute("data-local-path");
    if (href) void controller.followLink(href);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && get(open)) {
      event.stopPropagation();
      controller.close();
    }
  }

  onMount(() => {
    window.addEventListener("keydown", handleKeydown, true);
    return () => window.removeEventListener("keydown", handleKeydown, true);
  });
</script>

{#if $open}
  <div class="backdrop" onclick={onBackdropClick} role="presentation">
    <div class="panel" role="dialog" aria-labelledby="file-viewer-title">
      <header class="header">
        {#if $canGoBack}
          <button
            type="button"
            class="back"
            onclick={() => controller.back()}
            title={$t.fileViewerBack}
            aria-label={$t.fileViewerBack}
          >
            ←
          </button>
        {/if}
        <div class="title-wrap">
          <h2 id="file-viewer-title">{$fileName}</h2>
          <p class="path" title={$filePath}>{$filePath}</p>
        </div>
        <button type="button" class="close" onclick={() => controller.close()}>
          {$t.fileViewerClose}
        </button>
      </header>

      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div class="body" onclick={onContentClick}>
        {#if $loading}
          <p class="muted">{$t.fileViewerLoading}</p>
        {:else if $error}
          <p class="error">{$t.fileViewerError.replace("{message}", $error)}</p>
        {:else if $isMarkdown}
          <div class="markdown prose">{@html renderMarkdown($content)}</div>
        {:else}
          <pre class="plain">{$content}</pre>
        {/if}
      </div>

      <!-- No "open externally" action: Buddy never hands a file to another
           program (FR-CHAT-11). -->
      <footer class="footer">
        <button type="button" class="primary" onclick={() => controller.close()}>
          {$t.fileViewerClose}
        </button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 110;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(0, 0, 0, 0.45);
  }
  .panel {
    width: min(860px, 100%);
    max-height: min(80vh, 900px);
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--bg);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  }
  .header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
  }
  .title-wrap {
    min-width: 0;
  }
  h2 {
    margin: 0;
    font-size: 18px;
    line-height: 1.3;
  }
  .path {
    margin: 4px 0 0;
    color: var(--muted);
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .back {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-secondary);
    color: var(--fg);
    padding: 6px 12px;
    cursor: pointer;
    flex-shrink: 0;
    font-size: 15px;
    line-height: 1;
  }
  .close {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-secondary);
    color: var(--fg);
    padding: 6px 12px;
    cursor: pointer;
    flex-shrink: 0;
  }
  .body {
    flex: 1;
    overflow: auto;
    padding: 16px 20px;
  }
  .markdown :global(pre) {
    overflow-x: auto;
  }
  .plain {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 13px;
    line-height: 1.5;
  }
  .muted {
    color: var(--muted);
  }
  .error {
    color: var(--error-fg);
    background: var(--error-bg);
    border-radius: 8px;
    padding: 12px;
  }
  .footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 20px 16px;
    border-top: 1px solid var(--border);
  }
  .primary {
    border-radius: 8px;
    padding: 8px 14px;
    cursor: pointer;
    font-size: 14px;
    border: 1px solid var(--accent);
    background: var(--accent);
    color: var(--accent-fg);
  }
</style>
