// src/lib/new-topic-contract.ts — FR-TOPIC-01/05 contract for BDD and controller.
// DOM class name is shared between the Svelte component and integration tests.

export const NEW_TOPIC_BUTTON_CLASS = "new-topic-button";

/** New topic is unavailable while streaming or mid-transition (FR-TOPIC-05). */
export function isNewTopicDisabled(streaming: boolean, transitioning: boolean): boolean {
  return streaming || transitioning;
}
