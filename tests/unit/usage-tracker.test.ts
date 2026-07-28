// tests/unit/usage-tracker.test.ts — FR-COST-02/03 usage tracking and budget evaluation.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  computeBudgetStatus,
  createUsageTracker,
  getMonthlySummaryFromFile,
  isBudgetNearLimitFromStatus,
  loadUsageFile,
  recordUsageToFile,
  resolveMonthlyBudget,
} from "../../backends/usage-tracker";

describe("resolveMonthlyBudget", () => {
  it("defaults to 10 when unset", () => {
    expect(resolveMonthlyBudget({})).toBe(10);
  });

  it("returns null when disabled", () => {
    expect(resolveMonthlyBudget({ monthlyBudget: 0 })).toBeNull();
    expect(resolveMonthlyBudget({ monthlyBudget: null })).toBeNull();
  });

  it("returns explicit budget", () => {
    expect(resolveMonthlyBudget({ monthlyBudget: 25 })).toBe(25);
  });
});

describe("computeBudgetStatus", () => {
  it("marks warning at 80%", () => {
    const status = computeBudgetStatus(8, 10);
    expect(status.level).toBe("warning");
    expect(status.percent).toBe(80);
  });

  it("marks exceeded at 100%", () => {
    const status = computeBudgetStatus(10, 10);
    expect(status.level).toBe("exceeded");
  });

  it("is disabled without budget", () => {
    const status = computeBudgetStatus(99, null);
    expect(status.level).toBe("disabled");
  });
});

describe("isBudgetNearLimitFromStatus", () => {
  it("is false below 95%", () => {
    expect(isBudgetNearLimitFromStatus(computeBudgetStatus(9, 10))).toBe(false);
  });

  it("is true at 95%", () => {
    expect(isBudgetNearLimitFromStatus(computeBudgetStatus(9.5, 10))).toBe(true);
  });

  it("is true when exceeded", () => {
    expect(isBudgetNearLimitFromStatus(computeBudgetStatus(10, 10))).toBe(true);
  });

  it("is false when budget disabled", () => {
    expect(isBudgetNearLimitFromStatus(computeBudgetStatus(99, null))).toBe(false);
  });
});

describe("recordUsageToFile", () => {
  let configDir: string;

  afterEach(() => {
    if (configDir) rmSync(configDir, { recursive: true, force: true });
  });

  it("persists monthly totals", () => {
    configDir = mkdtempSync(join(tmpdir(), "ab-usage-"));
    const now = new Date(2026, 6, 24);
    recordUsageToFile(configDir, { cost: 1.5, tokens: 100 }, now);
    recordUsageToFile(configDir, { cost: 0.5, tokens: 50 }, now);
    const monthly = getMonthlySummaryFromFile(configDir, now);
    expect(monthly.totalCost).toBe(2);
    expect(monthly.totalTokens).toBe(150);
    expect(monthly.messageCount).toBe(2);
  });

  it("rolls over by month key", () => {
    configDir = mkdtempSync(join(tmpdir(), "ab-usage-"));
    recordUsageToFile(configDir, { cost: 3, tokens: 10 }, new Date(2026, 6, 31));
    recordUsageToFile(configDir, { cost: 1, tokens: 5 }, new Date(2026, 7, 1));
    const data = loadUsageFile(configDir);
    expect(Object.keys(data.months).sort()).toEqual(["2026-07", "2026-08"]);
  });
});

describe("createUsageTracker", () => {
  let configDir: string;

  afterEach(() => {
    if (configDir) rmSync(configDir, { recursive: true, force: true });
  });

  it("accumulates session and monthly totals", () => {
    configDir = mkdtempSync(join(tmpdir(), "ab-usage-"));
    const tracker = createUsageTracker(configDir, { getBudget: () => 10 });
    tracker.record({ cost: 1.5, tokens: 500 });
    tracker.record({ cost: 0.75, tokens: 200 });
    const report = tracker.getUsageReport();
    expect(report.session.totalCost).toBe(2.25);
    expect(report.monthly.totalCost).toBe(2.25);
  });

  it("fires warning alert once at 80%", () => {
    configDir = mkdtempSync(join(tmpdir(), "ab-usage-"));
    recordUsageToFile(configDir, { cost: 7.5, tokens: 100 }, new Date(2026, 6, 24));
    const onBudgetAlert = vi.fn();
    const tracker = createUsageTracker(configDir, {
      getBudget: () => 10,
      onBudgetAlert,
      nowFn: () => new Date(2026, 6, 24),
    });
    tracker.record({ cost: 1, tokens: 100 });
    expect(tracker.getUsageReport().budget.level).toBe("warning");
    expect(onBudgetAlert).toHaveBeenCalledTimes(1);
    tracker.record({ cost: 0.1, tokens: 10 });
    expect(onBudgetAlert).toHaveBeenCalledTimes(1);
  });

  it("blocks when budget exceeded", () => {
    configDir = mkdtempSync(join(tmpdir(), "ab-usage-"));
    recordUsageToFile(configDir, { cost: 9.5, tokens: 100 }, new Date(2026, 6, 24));
    const tracker = createUsageTracker(configDir, {
      getBudget: () => 10,
      nowFn: () => new Date(2026, 6, 24),
    });
    tracker.record({ cost: 1, tokens: 100 });
    expect(tracker.getUsageReport().budget.level).toBe("exceeded");
    expect(tracker.isBudgetExceeded()).toBe(true);
    expect(tracker.isBudgetNearLimit()).toBe(true);
  });

  it("isBudgetNearLimit at 95% without blocking send threshold", () => {
    configDir = mkdtempSync(join(tmpdir(), "ab-usage-"));
    recordUsageToFile(configDir, { cost: 9.5, tokens: 100 }, new Date(2026, 6, 24));
    const tracker = createUsageTracker(configDir, {
      getBudget: () => 10,
      nowFn: () => new Date(2026, 6, 24),
    });
    expect(tracker.isBudgetNearLimit()).toBe(true);
    expect(tracker.isBudgetExceeded()).toBe(false);
  });

  it("reloads monthly totals from disk in a new tracker", () => {
    configDir = mkdtempSync(join(tmpdir(), "ab-usage-"));
    const now = new Date(2026, 6, 24);
    recordUsageToFile(configDir, { cost: 4, tokens: 100 }, now);
    const tracker = createUsageTracker(configDir, {
      getBudget: () => 10,
      nowFn: () => now,
    });
    tracker.record({ cost: 1, tokens: 100 });
    expect(tracker.getUsageReport().monthly.totalCost).toBe(5);
  });
});

// M4 (H8). These methods used to reach `getUsageReport` through `this`, which
// works only while every call goes through the object. Detaching a method is
// the natural way to hand it to the heartbeat or a budget check, and it threw.
describe("tracker methods do not depend on how they are called", () => {
  it("survives destructuring", () => {
    const tracker = createUsageTracker(mkdtempSync(join(tmpdir(), "usage-detached-")), {
      getBudget: () => 10,
    });
    const { isBudgetExceeded, isBudgetNearLimit, checkAndFireAlerts } = tracker;

    expect(() => isBudgetExceeded()).not.toThrow();
    expect(() => isBudgetNearLimit()).not.toThrow();
    expect(() => checkAndFireAlerts()).not.toThrow();
  });

  it("survives being passed as a callback", () => {
    const tracker = createUsageTracker(mkdtempSync(join(tmpdir(), "usage-detached-")), {
      getBudget: () => 10,
    });
    const run = (fn: () => boolean) => fn();
    expect(() => run(tracker.isBudgetExceeded)).not.toThrow();
  });
});
