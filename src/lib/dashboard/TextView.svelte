<script lang="ts">
  import { renderMarkdown } from "../markdown";

  let { markdown }: { markdown: string } = $props();

  const html = $derived(renderMarkdown(markdown));
</script>

<div class="prose text-widget">{@html html}</div>

<style>
  .text-widget {
    font-size: 14px;
  }
</style>
