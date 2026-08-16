<script lang="ts">
  import { t } from "./i18n";

  let {
    visible,
  }: {
    visible: boolean;
  } = $props();
</script>

{#if visible}
  <div class="welcome" role="region" aria-label={$t.welcomeRegion}>
    <p class="greeting">{$t.welcomeGreeting}</p>
  </div>
{/if}

<style>
  .welcome {
    position: relative;
    padding: 16px 12px 8px;
  }
  .greeting {
    margin: 0;
    text-align: center;
    color: var(--muted);
    font-size: 14px;
  }
</style>
