// src/lib/input-bar.ts — Input bar DOM helpers (FR-CHAT-08).

const INPUT_TEXTAREA_MAX_HEIGHT_PX = 160;

export interface TextareaLike {
  style: { height: string };
  scrollHeight: number;
}

/** Grow textarea height up to maxHeightPx based on content. */
export function autoResizeTextarea(
  textarea: TextareaLike | undefined,
  maxHeightPx = INPUT_TEXTAREA_MAX_HEIGHT_PX,
): void {
  if (!textarea) return;
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeightPx)}px`;
}

/** Reset textarea to single-line default after send (FR-CHAT-08). */
export function resetTextareaHeight(textarea: TextareaLike | undefined): void {
  if (!textarea) return;
  textarea.style.height = "auto";
}

/**
 * Mirror InputBar send: clear via controller, then reset the textarea height
 * (FR-CHAT-08).
 *
 * `flush` waits for the framework to apply the cleared value to the DOM before
 * the height is reset. Without it the reset ran while the element still held
 * the old text, so `height: auto` resolved to the *old* content's height and
 * the box stayed tall until the next keystroke triggered `autoResize` — which
 * is exactly what a user sending a long message saw.
 */
export async function sendAndResetTextarea(
  send: () => Promise<void>,
  textarea: TextareaLike | undefined,
  flush?: () => Promise<unknown>,
): Promise<void> {
  await send();
  await flush?.();
  resetTextareaHeight(textarea);
}
