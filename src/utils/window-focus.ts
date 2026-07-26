// src/utils/window-focus.ts — Bring Buddy window to foreground after OS notifications.

import { getCurrentWindow } from "@tauri-apps/api/window";

export async function focusAppWindow(): Promise<void> {
  try {
    const win = getCurrentWindow();
    await win.unminimize();
    await win.show();
    await win.setFocus();
  } catch {
    // Browser dev without Tauri window API.
  }
}
