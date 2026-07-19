<script lang="ts">
  import type { ChatMessage } from "./chat-controller";

  let { message }: { message: ChatMessage } = $props();
</script>

<div class="row {message.role}">
  <div class="bubble {message.role}">{message.text}</div>
</div>

<style>
  .row {
    display: flex;
    padding: 4px 12px;
  }
  .row.user {
    justify-content: flex-end;
  }
  .row.assistant {
    justify-content: flex-start;
  }
  .bubble {
    max-width: 75%;
    padding: 10px 14px;
    border-radius: 14px;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .bubble.user {
    background: var(--bubble-user);
    color: var(--bubble-user-fg);
    border-bottom-right-radius: 4px;
  }
  .bubble.assistant {
    background: var(--bubble-assistant);
    color: var(--bubble-assistant-fg);
    border-bottom-left-radius: 4px;
  }
</style>
