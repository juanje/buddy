// backends/prompt-queue.ts — Hold user prompts that arrive before the session
// exists (FR-CHAT-13).
//
// Session boot performs a full LLM call before the worker core is created: the
// silent context injection, which seeds the conversation history with the logs
// index, the last session and due deferred items. Its response is discarded on
// purpose — the point is that the model has read it before the user's first
// turn, not that it says anything back.
//
// That ordering is deliberate and cannot be relaxed without giving up the
// guarantee that the first answer is informed. What it produces is a window in
// which the UI is fully interactive and the session is not: 1–3 seconds on a
// commercial provider, 81 seconds measured against a local model. Prompts sent
// in that window used to reach `core?.api.prompt(...)` with `core` undefined
// and vanish, returning success.

import type { PromptOptions } from "../shared/api";

export type PromptDelivery = (text: string, options?: PromptOptions) => Promise<void>;

export interface PromptQueue {
  /** Send now if the session is up, otherwise hold until it is. */
  submit(text: string, options?: PromptOptions): Promise<void>;
  /** Attach the live session and flush anything waiting, in order. */
  ready(deliver: PromptDelivery): Promise<void>;
  /** How many prompts are waiting for a session. */
  pending(): number;
}

interface HeldPrompt {
  text: string;
  options?: PromptOptions;
}

export function createPromptQueue(): PromptQueue {
  const held: HeldPrompt[] = [];
  let deliver: PromptDelivery | undefined;

  return {
    async submit(text, options) {
      if (deliver) {
        await deliver(text, options);
        return;
      }
      held.push({ text, options });
    },

    async ready(nextDeliver) {
      deliver = nextDeliver;
      // Drained as we go: a failure part-way leaves the rest queued rather than
      // dropping them, and the error reaches the caller instead of being
      // swallowed — silence is the failure mode this module exists to end.
      while (held.length > 0) {
        const next = held[0]!;
        await nextDeliver(next.text, next.options);
        held.shift();
      }
    },

    pending: () => held.length,
  };
}
