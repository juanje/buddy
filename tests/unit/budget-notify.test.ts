// tests/unit/budget-notify.test.ts — FR-COST-03 budget threshold notifications.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-notification", () => ({
  sendNotification: vi.fn(),
  isPermissionGranted: vi.fn(async () => true),
  requestPermission: vi.fn(async () => "granted"),
  onAction: vi.fn(async () => ({ unregister: vi.fn() })),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    unminimize: vi.fn(),
    show: vi.fn(),
    setFocus: vi.fn(),
  }),
}));

import { isPermissionGranted, sendNotification } from "@tauri-apps/plugin-notification";

import type { BudgetStatus } from "../../shared/api";
import {
  formatBudgetNotificationBody,
  notifyBudgetAlert,
  resetBudgetNotifyStateForTests,
} from "../../src/utils/budget-notify";

function status(level: BudgetStatus["level"], monthlyCost: number): BudgetStatus {
  return { level, monthlyCost, budget: 10, percent: monthlyCost / 10, remaining: 10 - monthlyCost };
}

const LABELS = {
  warningTitle: "Presupuesto al 80%",
  exceededTitle: "Presupuesto agotado",
  body: "Llevas 8.00 de 10.00",
};

describe("notifyBudgetAlert (FR-COST-03)", () => {
  beforeEach(() => {
    resetBudgetNotifyStateForTests();
    vi.mocked(sendNotification).mockClear();
    vi.mocked(isPermissionGranted).mockResolvedValue(true);
  });

  it("titles a warning with the warning title and an overrun with the exceeded one", async () => {
    await notifyBudgetAlert(status("warning", 8), LABELS);
    expect(sendNotification).toHaveBeenCalledWith({
      title: LABELS.warningTitle,
      body: LABELS.body,
      autoCancel: true,
    });

    resetBudgetNotifyStateForTests();
    vi.mocked(sendNotification).mockClear();

    await notifyBudgetAlert(status("exceeded", 10.5), LABELS);
    expect(sendNotification).toHaveBeenCalledWith({
      title: LABELS.exceededTitle,
      body: LABELS.body,
      autoCancel: true,
    });
  });

  it("fires each threshold once per app session", async () => {
    await notifyBudgetAlert(status("warning", 8), LABELS);
    await notifyBudgetAlert(status("warning", 8.5), LABELS);
    expect(sendNotification).toHaveBeenCalledTimes(1);

    // A different threshold is a different event and still gets through.
    await notifyBudgetAlert(status("exceeded", 10.5), LABELS);
    expect(sendNotification).toHaveBeenCalledTimes(2);
  });

  it("says nothing below the warning threshold or when the budget is disabled", async () => {
    await notifyBudgetAlert(status("ok", 2), LABELS);
    await notifyBudgetAlert(status("disabled", 99), LABELS);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("stays silent when notification permission was refused", async () => {
    vi.mocked(isPermissionGranted).mockResolvedValue(false);
    await notifyBudgetAlert(status("warning", 8), LABELS);
    expect(sendNotification).not.toHaveBeenCalled();
  });
});

describe("formatBudgetNotificationBody (FR-COST-03)", () => {
  const templates = {
    warning: "Llevas {spent} de {budget}",
    exceeded: "Has superado {budget} ({spent})",
  };

  // This is why notifyBudgetAlert needs one body and not one per level: the
  // body is already chosen here. Passing both made the caller compute the same
  // string twice under two names.
  it("picks the template from the level and fills spend and cap", () => {
    expect(formatBudgetNotificationBody(status("warning", 8), templates)).toBe(
      "Llevas 8.00 de 10.00",
    );
    expect(formatBudgetNotificationBody(status("exceeded", 10.5), templates)).toBe(
      "Has superado 10.00 (10.50)",
    );
  });

  it("treats a missing budget as zero rather than printing undefined", () => {
    const noBudget: BudgetStatus = { ...status("exceeded", 1), budget: null };
    expect(formatBudgetNotificationBody(noBudget, templates)).toBe("Has superado 0.00 (1.00)");
  });
});
