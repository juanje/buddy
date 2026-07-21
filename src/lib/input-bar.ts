// src/lib/input-bar.ts — Input bar DOM helpers (FR-CHAT-08).

export const INPUT_TEXTAREA_MAX_HEIGHT_PX = 160;

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

/** Mirror InputBar send: clear via controller, then reset textarea height. */
export async function sendAndResetTextarea(
  send: () => Promise<void>,
  textarea: TextareaLike | undefined,
): Promise<void> {
  await send();
  resetTextareaHeight(textarea);
}
