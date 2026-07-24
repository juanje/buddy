// backends/usage-tracker.ts — Session/monthly cost tracking and budget evaluation (FR-COST-02/03).

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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
  const filePath = usageFilePath(configDir);
  if (!existsSync(filePath)) {
    return { months: {} };
  }
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Partial<UsageFileData>;
    if (!parsed.months || typeof parsed.months !== "object") {
      return { months: {} };
    }
    return { months: parsed.months };
  } catch {
    return { months: {} };
  }
}

function writeUsageFile(configDir: string, data: UsageFileData): void {
  mkdirSync(configDir, { recursive: true });
  const filePath = usageFilePath(configDir);
  const tmp = join(configDir, `.usage.${process.pid}.tmp`);
  writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
  renameSync(tmp, filePath);
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
 * Read-modify-write on usage.json; no in-memory session state.
 */
export function recordUsageToFile(
  configDir: string,
  input: RecordUsageInput,
  now: Date = new Date(),
): UsageSummary {
  if (input.cost <= 0 && input.tokens <= 0) {
    return getMonthlySummaryFromFile(configDir, now);
  }
  const data = loadUsageFile(configDir);
  const key = monthKey(now);
  const current = data.months[key] ?? { ...EMPTY_SUMMARY };
  data.months[key] = addToSummary(current, input);
  writeUsageFile(configDir, data);
  return data.months[key];
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
