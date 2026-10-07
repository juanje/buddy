<script lang="ts">
  let { title, message }: { title: string; message: string } = $props();
</script>

<div class="error-card" role="alert">
  <p class="error-title">{title}</p>
  <p class="error-message">{message}</p>
</div>

<style>
  .error-card {
    border-radius: 8px;
    padding: 10px 12px;
    background: var(--error-bg);
    color: var(--error-fg);
  }
  .error-title {
    margin: 0 0 4px;
    font-weight: 600;
    font-size: 13px;
  }
  .error-message {
    margin: 0;
    font-size: 13px;
    white-space: pre-wrap;
  }
</style>
