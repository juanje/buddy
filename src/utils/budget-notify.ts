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

export async function notifyBudgetAlert(
  status: BudgetStatus,
  labels: { warningTitle: string; warningBody: string; exceededTitle: string; exceededBody: string },
): Promise<void> {
  if (status.level !== "warning" && status.level !== "exceeded") return;
  if (notifyInFlight) return;
  if (lastNotifiedLevel === status.level) return;

  notifyInFlight = true;
  try {
    const granted = await isPermissionGranted();
    if (!granted) return;

    await ensureDeferredNotificationClickHandler();

    const isWarning = status.level === "warning";
    sendNotification({
      title: isWarning ? labels.warningTitle : labels.exceededTitle,
      body: isWarning ? labels.warningBody : labels.exceededBody,
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
