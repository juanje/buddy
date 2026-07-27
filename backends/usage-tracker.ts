// backends/usage-tracker.ts — Session/monthly cost tracking and budget evaluation (FR-COST-02/03).

import { join } from "node:path";

import { readStateFile, updateStateFile } from "./state-file";

import type { AgentEvent, BudgetStatus, SetupConfig, UsageReport, UsageSummary } from "../shared/api";
import {
  BUDGET_BACKGROUND_THRESHOLD,
  BUDGET_WARNING_THRESHOLD,
  DEFAULT_MONTHLY_BUDGET,
  USAGE_FILE_NAME,
} from "../shared/defaults";

export interface RecordUsageInput {
  cost: number;
  tokens: number;
}

interface UsageMonthEntry extends UsageSummary {}

export interface UsageFileData {
  months: Record<string, UsageMonthEntry>;
}

const EMPTY_SUMMARY: UsageSummary = { totalCost: 0, totalTokens: 0, messageCount: 0 };

export function usageFilePath(configDir: string): string {
  return join(configDir, USAGE_FILE_NAME);
}

export function monthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function roundCost(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function addToSummary(summary: UsageSummary, input: RecordUsageInput): UsageSummary {
  return {
    totalCost: roundCost(summary.totalCost + input.cost),
    totalTokens: summary.totalTokens + input.tokens,
    messageCount: summary.messageCount + 1,
  };
}

export function loadUsageFile(configDir: string): UsageFileData {
  const parsed = readStateFile<Partial<UsageFileData>>(usageFilePath(configDir));
  if (!parsed?.months || typeof parsed.months !== "object") {
    return { months: {} };
  }
  return { months: parsed.months };
}

export function getMonthlySummaryFromFile(
  configDir: string,
  date: Date = new Date(),
): UsageSummary {
  const data = loadUsageFile(configDir);
  return data.months[monthKey(date)] ?? { ...EMPTY_SUMMARY };
}

/** Resolve configured budget: undefined → default; 0/null → disabled. */
export function resolveMonthlyBudget(config: Pick<SetupConfig, "monthlyBudget">): number | null {
  const raw = config.monthlyBudget;
  if (raw === 0 || raw === null) return null;
  if (raw === undefined) return DEFAULT_MONTHLY_BUDGET;
  return raw;
}

export function computeBudgetStatus(
  monthlyCost: number,
  budget: number | null,
): BudgetStatus {
  if (budget == null || budget <= 0) {
    return {
      level: "disabled",
      percent: 0,
      remaining: 0,
      budget: null,
      monthlyCost,
    };
  }
  const percent = budget > 0 ? (monthlyCost / budget) * 100 : 0;
  const remaining = Math.max(0, roundCost(budget - monthlyCost));
  let level: BudgetStatus["level"] = "ok";
  if (percent >= 100) {
    level = "exceeded";
  } else if (percent >= BUDGET_WARNING_THRESHOLD * 100) {
    level = "warning";
  }
  return {
    level,
    percent: roundCost(percent),
    remaining,
    budget,
    monthlyCost,
  };
}

export function extractUsageFromAgentEvent(event: AgentEvent): RecordUsageInput | null {
  if (event.type !== "message_end") return null;
  const message = event.message as
    | {
        role?: string;
        usage?: { totalTokens?: number; cost?: { total?: number } };
      }
    | undefined;
  if (message?.role !== "assistant" || !message.usage?.cost) return null;
  return {
    cost: message.usage.cost.total ?? 0,
    tokens: message.usage.totalTokens ?? 0,
  };
}

export function sumUsageFromEvents(events: AgentEvent[]): RecordUsageInput {
  let cost = 0;
  let tokens = 0;
  let count = 0;
  for (const event of events) {
    const usage = extractUsageFromAgentEvent(event);
    if (!usage) continue;
    cost += usage.cost;
    tokens += usage.tokens;
    count += 1;
  }
  if (count === 0) return { cost: 0, tokens: 0 };
  return { cost: roundCost(cost), tokens };
}

/**
 * Standalone write for background processes (reflect, consolidation).
 *
 * NFR-REL-06: three writers across two processes share this file — the worker,
 * the reflect child and the consolidation session. The read-modify-write runs
 * under a cross-process lock, because losing an update here means
 * under-counting spend, and under-counting is the unsafe direction for a cap.
 */
export function recordUsageToFile(
  configDir: string,
  input: RecordUsageInput,
  now: Date = new Date(),
): UsageSummary {
  if (input.cost <= 0 && input.tokens <= 0) {
    return getMonthlySummaryFromFile(configDir, now);
  }
  const key = monthKey(now);
  const updated = updateStateFile<UsageFileData>(
    usageFilePath(configDir),
    (current) => {
      const months = current?.months ?? {};
      return {
        ...current,
        months: { ...months, [key]: addToSummary(months[key] ?? { ...EMPTY_SUMMARY }, input) },
      };
    },
  );
  return updated.months[key]!;
}

/**
 * Record the usage of a completed background session (NFR-SEC-14b).
 *
 * Every session must account for what it spent; a call site that forgets makes
 * its cost invisible to the budget cap. Kept as one helper so there is one
 * place to get it right.
 */
export function recordSessionUsage(configDir: string, events: AgentEvent[], now?: Date): void {
  const usage = sumUsageFromEvents(events);
  if (usage.cost <= 0 && usage.tokens <= 0) return;
  try {
    recordUsageToFile(configDir, usage, now);
  } catch (error) {
    // Never fail a session over accounting. An unreadable or locked usage file
    // is reported, not silently overwritten (NFR-REL-08).
    console.error("[usage] could not record session usage:", error);
  }
}

export function isBudgetNearLimitFromStatus(budget: BudgetStatus): boolean {
  return (
    budget.level === "exceeded" ||
    (budget.budget != null && budget.percent >= BUDGET_BACKGROUND_THRESHOLD * 100)
  );
}

export interface UsageTracker {
  record(input: RecordUsageInput, now?: Date): BudgetStatus;
  recordFromEvent(event: AgentEvent, now?: Date): BudgetStatus | null;
  getUsageReport(): UsageReport;
  isBudgetExceeded(): boolean;
  isBudgetNearLimit(): boolean;
  checkAndFireAlerts(): BudgetStatus;
  resetSessionAlertDedup(): void;
}

export interface UsageTrackerOptions {
  getBudget: () => number | null;
  onBudgetAlert?: (status: BudgetStatus) => void;
  nowFn?: () => Date;
}

export function createUsageTracker(
  configDir: string,
  options: UsageTrackerOptions,
): UsageTracker {
  let sessionSummary: UsageSummary = { ...EMPTY_SUMMARY };
  const firedAlerts = new Set<BudgetStatus["level"]>();

  function currentMonthly(now: Date): UsageSummary {
    return getMonthlySummaryFromFile(configDir, now);
  }

  function maybeFireAlert(status: BudgetStatus): void {
    if (status.level !== "warning" && status.level !== "exceeded") return;
    if (firedAlerts.has(status.level)) return;
    firedAlerts.add(status.level);
    options.onBudgetAlert?.(status);
  }

  function record(input: RecordUsageInput, now: Date = options.nowFn?.() ?? new Date()): BudgetStatus {
    if (input.cost > 0 || input.tokens > 0) {
      sessionSummary = addToSummary(sessionSummary, input);
      recordUsageToFile(configDir, input, now);
    }
    const status = computeBudgetStatus(currentMonthly(now).totalCost, options.getBudget());
    maybeFireAlert(status);
    return status;
  }

  return {
    record,
    recordFromEvent(event, now) {
      const usage = extractUsageFromAgentEvent(event);
      if (!usage) return null;
      return record(usage, now);
    },
    getUsageReport() {
      const now = options.nowFn?.() ?? new Date();
      const monthly = currentMonthly(now);
      const budget = computeBudgetStatus(monthly.totalCost, options.getBudget());
      return {
        session: { ...sessionSummary },
        monthly: { ...monthly },
        budget,
      };
    },
    isBudgetExceeded() {
      const report = this.getUsageReport();
      return report.budget.level === "exceeded";
    },
    isBudgetNearLimit() {
      return isBudgetNearLimitFromStatus(this.getUsageReport().budget);
    },
    checkAndFireAlerts() {
      const status = this.getUsageReport().budget;
      maybeFireAlert(status);
      return status;
    },
    resetSessionAlertDedup() {
      firedAlerts.clear();
    },
  };
}
