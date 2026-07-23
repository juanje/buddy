// src/utils/deferred-notify.ts — OS notifications for due deferred items (FR-DEFERRED-03).

import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  isPermissionGranted,
  onAction,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

/** Don't re-fire within 25 min (heartbeat default is 30). */
export const DEFERRED_NOTIFY_DEDUP_MS = 25 * 60 * 1000;

let lastNotifiedAt = 0;
let clickHandlerRegistered = false;
let notifyInFlight = false;

export function resetDeferredNotifyStateForTests(): void {
  lastNotifiedAt = 0;
  clickHandlerRegistered = false;
  notifyInFlight = false;
}

async function focusAppWindow(): Promise<void> {
  try {
    const win = getCurrentWindow();
    await win.unminimize();
    await win.show();
    await win.setFocus();
  } catch {
    // Browser dev without Tauri window API.
  }
}

/** Register once: clicking a notification focuses the Buddy window. */
export async function ensureDeferredNotificationClickHandler(): Promise<void> {
  if (clickHandlerRegistered) return;
  try {
    await onAction(() => {
      void focusAppWindow();
    });
    clickHandlerRegistered = true;
  } catch {
    // Browser dev without notification plugin.
  }
}

/**
 * Request notification permission eagerly (call at app start when window has focus).
 * macOS won't show the permission prompt to a background app.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      console.warn("[deferred-notify] permission not yet granted, requesting…");
      granted = (await requestPermission()) === "granted";
    }
    if (!granted) {
      console.warn("[deferred-notify] permission denied by user/system");
    }
    return granted;
  } catch (err) {
    console.warn("[deferred-notify] ensurePermission failed:", err);
    return false;
  }
}

export async function notifyDeferredDue(
  count: number,
  labels: { title: string; body: string },
): Promise<void> {
  if (count <= 0) return;
  if (notifyInFlight) return;

  const now = Date.now();
  if (now - lastNotifiedAt < DEFERRED_NOTIFY_DEDUP_MS) return;

  notifyInFlight = true;
  try {
    const granted = await isPermissionGranted();
    if (!granted) {
      console.warn("[deferred-notify] permission not granted — skipping (should have been requested at startup)");
      return;
    }

    await ensureDeferredNotificationClickHandler();
    sendNotification({ title: labels.title, body: labels.body, autoCancel: true });
    lastNotifiedAt = now;
    console.info(`[deferred-notify] sent: "${labels.body}"`);
  } catch (err) {
    console.warn("[deferred-notify] failed:", err);
  } finally {
    notifyInFlight = false;
  }
}
