// src/utils/maintenance-notify.ts — OS notification when background
// maintenance is abandoned (FR-CONSOL-09).
//
// Silence is the failure mode this exists to prevent: before H3, a depth that
// failed deterministically retried every 30 minutes forever, each retry a
// billed LLM call, with nothing shown to the user.

import { isPermissionGranted, sendNotification } from "@tauri-apps/plugin-notification";

import type { MaintenancePausedInfo } from "../../shared/api";
import { ensureDeferredNotificationClickHandler } from "./deferred-notify";
import { focusAppWindow } from "./window-focus";

const notifiedDepths = new Set<number>();

export function resetMaintenanceNotifyStateForTests(): void {
  notifiedDepths.clear();
}

export async function notifyMaintenancePaused(
  info: MaintenancePausedInfo,
  labels: { title: string; body: string },
): Promise<void> {
  if (notifiedDepths.has(info.depth)) return;
  notifiedDepths.add(info.depth);

  try {
    const granted = await isPermissionGranted();
    if (!granted) return;

    await ensureDeferredNotificationClickHandler();
    sendNotification({ title: labels.title, body: labels.body, autoCancel: true });
    void focusAppWindow();
  } catch (err) {
    console.warn("[maintenance-notify] failed:", err);
  }
}
