// src/lib/keyboard.ts — input bar keyboard resolution (FR-CHAT-02).
// Pure, deterministic: unit-tested.

export type InputKeyAction = "send" | "newline" | "none";

export interface KeyLike {
  key: string;
  shiftKey: boolean;
}

/** Enter sends, Shift+Enter inserts a newline, anything else is untouched. */
export function resolveInputKey(event: KeyLike): InputKeyAction {
  if (event.key !== "Enter") return "none";
  return event.shiftKey ? "newline" : "send";
}
