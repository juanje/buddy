<script lang="ts">
  import type { SetupController } from "../setup-controller";
  import { tierDescription, t } from "../i18n";
  import "./wizard-shared.css";

  let {
    controller,
    onContinue,
    onBack,
  }: {
    controller: SetupController;
    onContinue: () => void;
    onBack?: () => void;
  } = $props();

  const provider = $derived(controller.provider);
  const model = $derived(controller.model);
  const canProceed = $derived(controller.canProceed);
  const availableModels = $derived(controller.availableModels);
  const loadingModels = $derived(controller.loadingModels);

  $effect(() => {
    if ($provider) {
      void controller.loadModels();
    }
  });
</script>

<h2>{$t.modelTitle}</h2>
<p class="muted">{$t.modelHint}</p>

{#if $loadingModels}
  <p class="muted">{$t.modelLoading}</p>
{:else if $availableModels.length > 0}
  <div class="models">
    {#each $availableModels as choice (choice.id)}
      <button
        class="model-card"
        class:selected={$model === choice.id}
        onclick={() => controller.selectModel(choice.id)}
      >
        <strong>
          {choice.label}
          {#if choice.recommended}
            <span class="badge">{$t.modelRecommended}</span>
          {/if}
        </strong>
        {#if choice.tier}
          <span class="tier">{tierDescription(choice.tier)}</span>
        {:else}
          <span class="tier">{choice.id}</span>
        {/if}
      </button>
    {/each}
  </div>
{:else if $provider === "custom"}
  <label class="field">
    <span>{$t.modelCustomLabel}</span>
    <input
      type="text"
      spellcheck="false"
      value={$model ?? ""}
      oninput={(e) => controller.selectModel(e.currentTarget.value)}
    />
  </label>
  <p class="muted">{$t.modelCustomHint}</p>
{/if}

<div class="actions">
  {#if onBack}
    <button type="button" class="ghost" onclick={onBack}>{$t.wizardBack}</button>
  {/if}
  <button class="primary" onclick={onContinue} disabled={!$canProceed}>
    {$t.wizardContinue}
  </button>
</div>

<style>
  .muted {
    color: var(--muted);
    font-size: 13px;
  }
  .models {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: min(420px, 80vw);
  }
  .model-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-start;
    text-align: left;
    padding: 10px 14px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--fg);
    border-radius: 8px;
    cursor: pointer;
  }
  .model-card.selected {
    border-color: var(--accent, #4f46e5);
    outline: 2px solid var(--accent, #4f46e5);
  }
  .model-card .tier {
    font-size: 12px;
    color: var(--muted);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-start;
  }
  .field input {
    width: min(420px, 80vw);
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-secondary);
    color: var(--fg);
    font-size: 14px;
  }
  .actions {
    margin-top: 8px;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
