// src/utils/budget-notify.ts — OS notifications for budget thresholds (FR-COST-03).

import {
  isPermissionGranted,
  sendNotification,
} from "@tauri-apps/plugin-notification";

import type { BudgetStatus } from "../../shared/api";
import { ensureDeferredNotificationClickHandler } from "./deferred-notify";
import { focusAppWindow } from "./window-focus";

let lastNotifiedLevel: BudgetStatus["level"] | null = null;
let notifyInFlight = false;

export function resetBudgetNotifyStateForTests(): void {
  lastNotifiedLevel = null;
  notifyInFlight = false;
}

/**
 * Notify once per threshold per app session (FR-COST-03).
 *
 * `body` is singular on purpose. `formatBudgetNotificationBody` already selects
 * its template from `status.level`, so asking for a warning body *and* an
 * exceeded body made the only caller compute the identical string twice under
 * two names. The title is the one thing that genuinely differs.
 */
export async function notifyBudgetAlert(
  status: BudgetStatus,
  labels: { warningTitle: string; exceededTitle: string; body: string },
): Promise<void> {
  if (status.level !== "warning" && status.level !== "exceeded") return;
  if (notifyInFlight) return;
  if (lastNotifiedLevel === status.level) return;

  notifyInFlight = true;
  try {
    const granted = await isPermissionGranted();
    if (!granted) return;

    await ensureDeferredNotificationClickHandler();

    sendNotification({
      title: status.level === "warning" ? labels.warningTitle : labels.exceededTitle,
      body: labels.body,
      autoCancel: true,
    });
    void focusAppWindow();
    lastNotifiedLevel = status.level;
  } catch (err) {
    console.warn("[budget-notify] failed:", err);
  } finally {
    notifyInFlight = false;
  }
}

export function formatBudgetNotificationBody(
  status: BudgetStatus,
  templates: { warning: string; exceeded: string },
): string {
  const budget = status.budget ?? 0;
  const spent = status.monthlyCost.toFixed(2);
  const cap = budget.toFixed(2);
  if (status.level === "warning") {
    return templates.warning.replace("{spent}", spent).replace("{budget}", cap);
  }
  return templates.exceeded.replace("{spent}", spent).replace("{budget}", cap);
}
