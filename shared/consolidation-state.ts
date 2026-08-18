// shared/consolidation-state.ts — Consolidation counters and run journal (FR-CONSOL-01/06).

/** @backend-only — imports node:fs, node:path; not browser-safe. */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  CONSOLIDATION_BACKOFF_BASE_MS,
  CONSOLIDATION_LOG_PATH,
  CONSOLIDATION_RETRY_CEILING,
  CONSOLIDATION_STATE_PATH,
  DEPTH2_CALENDAR_DAYS,
  DEPTH3_CALENDAR_DAYS,
} from "./defaults";
import { MS_PER_DAY, MS_PER_HOUR, toLocalIsoStamp } from "./dates";

/** Consecutive-failure tracking for one depth (FR-CONSOL-09). */
export interface DepthFailureState {
  count: number;
  lastFailureAt: string;
}

export interface SkillUsageEntry {
  lastInvoked: string;
  invokedThisPeriod: number;
  totalInvocations: number;
}

export interface Depth2Snapshot {
  capturedAt: string;
  userMdHash: string;
  agentsMdHash: string;
  rightNowContent: string;
  userMdContent?: string;
}

export interface ConsolidationState {
  sessionsSinceLastDepth1: number;
  depth1RunsSinceLastDepth2: number;
  depth2RunsSinceLastDepth3: number;
  lastDepth1: string | null;
  lastDepth2: string | null;
  lastDepth3: string | null;
  /** Per-skill invocation tracking (FR-CONSOL-18). */
  skillUsage?: Record<string, SkillUsageEntry>;
  /** Snapshot after each depth-2 for weekly diffing (FR-CONSOL-19). */
  lastDepth2Snapshot?: Depth2Snapshot;
  /** Path to the live Pi session file (FR-REFLECT-05). */
  liveSessionFile?: string | null;
  /** True when session-end reflect was requested but may not have completed. */
  reflectPending?: boolean;
  /** Per-depth consecutive failures, keyed by depth (FR-CONSOL-09). */
  failures?: Record<string, DepthFailureState>;
}

export interface ConsolidationLogEntry {
  timestamp: string;
  depth: number;
  duration_ms: number;
  status: "success" | "fail" | "skipped" | "budget-stopped";
  error?: string;
}

export const CONSOLIDATION_THRESHOLDS = {
  depth1: { sessions: 3, maxHours: 24 },
  depth2: { depth1Runs: 3, calendarDays: DEPTH2_CALENDAR_DAYS },
  depth3: { depth2Runs: 4, calendarDays: DEPTH3_CALENDAR_DAYS },
} as const;

export function defaultConsolidationState(): ConsolidationState {
  return {
    sessionsSinceLastDepth1: 0,
    depth1RunsSinceLastDepth2: 0,
    depth2RunsSinceLastDepth3: 0,
    lastDepth1: null,
    lastDepth2: null,
    lastDepth3: null,
    liveSessionFile: null,
    reflectPending: false,
  };
}

function stateFilePath(rootDir: string): string {
  return join(rootDir, CONSOLIDATION_STATE_PATH);
}

function logFilePath(rootDir: string): string {
  return join(rootDir, CONSOLIDATION_LOG_PATH);
}

export function loadConsolidationState(rootDir: string): ConsolidationState {
  const path = stateFilePath(rootDir);
  if (!existsSync(path)) return defaultConsolidationState();
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<ConsolidationState>;
    return { ...defaultConsolidationState(), ...parsed };
  } catch {
    return defaultConsolidationState();
  }
}

export function saveConsolidationState(rootDir: string, state: ConsolidationState): void {
  const path = stateFilePath(rootDir);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2) + "\n");
}

export function loadConsolidationLog(rootDir: string): ConsolidationLogEntry[] {
  const path = logFilePath(rootDir);
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as ConsolidationLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendConsolidationLogEntry(
  rootDir: string,
  entry: ConsolidationLogEntry,
): void {
  const path = logFilePath(rootDir);
  const log = loadConsolidationLog(rootDir);
  log.push(entry);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(log, null, 2) + "\n");
}

function hoursSince(isoTimestamp: string | null, now: Date): number {
  if (!isoTimestamp) return Infinity;
  try {
    return (now.getTime() - new Date(isoTimestamp).getTime()) / MS_PER_HOUR;
  } catch {
    return Infinity;
  }
}

function daysSince(isoTimestamp: string | null, now: Date): number {
  if (!isoTimestamp) return Infinity;
  try {
    return (now.getTime() - new Date(isoTimestamp).getTime()) / MS_PER_DAY;
  } catch {
    return Infinity;
  }
}

/**
 * Depth-1 uses a hybrid trigger: fires when EITHER the session count threshold
 * is met OR enough hours have elapsed since the last run (with at least 1 session
 * of new content). This prevents stale content from sitting unconsolidated when
 * the user has few but long sessions.
 */
export function isDepthDue(depth: 1 | 2 | 3, state: ConsolidationState, now?: Date): boolean {
  const at = now ?? new Date();
  switch (depth) {
    case 1: {
      const sessionsDue = state.sessionsSinceLastDepth1 >= CONSOLIDATION_THRESHOLDS.depth1.sessions;
      const timeDue =
        state.lastDepth1 !== null &&
        state.sessionsSinceLastDepth1 > 0 &&
        hoursSince(state.lastDepth1, at) >= CONSOLIDATION_THRESHOLDS.depth1.maxHours;
      return sessionsDue || timeDue;
    }
    case 2: {
      const runsDue =
        state.depth1RunsSinceLastDepth2 >= CONSOLIDATION_THRESHOLDS.depth2.depth1Runs;
      const calendarDue =
        state.lastDepth2 !== null &&
        state.depth1RunsSinceLastDepth2 > 0 &&
        daysSince(state.lastDepth2, at) >= CONSOLIDATION_THRESHOLDS.depth2.calendarDays;
      return runsDue || calendarDue;
    }
    case 3: {
      const runsDue =
        state.depth2RunsSinceLastDepth3 >= CONSOLIDATION_THRESHOLDS.depth3.depth2Runs;
      const calendarDue =
        state.lastDepth3 !== null &&
        state.depth2RunsSinceLastDepth3 > 0 &&
        daysSince(state.lastDepth3, at) >= CONSOLIDATION_THRESHOLDS.depth3.calendarDays;
      return runsDue || calendarDue;
    }
  }
}

// ---------------------------------------------------------------------------
// Failure tracking (FR-CONSOL-09)
//
// A depth that fails deterministically used to retry on every heartbeat tick
// forever, each retry costing a full LLM call. Failures are now counted per
// depth, retried with exponential backoff, and abandoned at a ceiling.
// ---------------------------------------------------------------------------

export type DepthBlockReason = "backoff" | "abandoned";

export function depthFailureCount(state: ConsolidationState, depth: 1 | 2 | 3): number {
  return state.failures?.[String(depth)]?.count ?? 0;
}

/** Delay before the next attempt: base × 2^(failures−1). */
export function backoffDelayMs(failureCount: number): number {
  if (failureCount <= 0) return 0;
  return CONSOLIDATION_BACKOFF_BASE_MS * 2 ** (failureCount - 1);
}

/**
 * Why a depth may not run right now, or null when it is free to run.
 * `abandoned` is terminal until a manual reset; `backoff` clears with time.
 */
export function depthBlockReason(
  state: ConsolidationState,
  depth: 1 | 2 | 3,
  now: Date = new Date(),
): DepthBlockReason | null {
  const failure = state.failures?.[String(depth)];
  if (!failure || failure.count <= 0) return null;
  if (failure.count >= CONSOLIDATION_RETRY_CEILING) return "abandoned";

  const since = now.getTime() - new Date(failure.lastFailureAt).getTime();
  if (Number.isNaN(since)) return null;
  return since < backoffDelayMs(failure.count) ? "backoff" : null;
}

export function recordDepthFailure(
  state: ConsolidationState,
  depth: 1 | 2 | 3,
  now: Date = new Date(),
): DepthFailureState {
  const key = String(depth);
  const current = state.failures?.[key]?.count ?? 0;
  const next: DepthFailureState = {
    count: current + 1,
    lastFailureAt: toLocalIsoStamp(now),
  };
  state.failures = { ...(state.failures ?? {}), [key]: next };
  return next;
}

/** A successful run clears the depth's failure history. */
export function clearDepthFailure(state: ConsolidationState, depth: 1 | 2 | 3): void {
  if (!state.failures?.[String(depth)]) return;
  const { [String(depth)]: _removed, ...rest } = state.failures;
  state.failures = rest;
}

/**
 * Highest consolidation depth whose usage threshold is met and which is not
 * blocked by backoff or abandonment, or null. Falls through to lower depths:
 * a broken depth 3 must not stop daily consolidation from running.
 */
export function determineTargetDepth(state: ConsolidationState, now?: Date): 1 | 2 | 3 | null {
  const at = now ?? new Date();
  for (const depth of [3, 2, 1] as const) {
    if (isDepthDue(depth, state, at) && depthBlockReason(state, depth, at) === null) {
      return depth;
    }
  }
  return null;
}

/** Depths to run in cascade order when consolidating at `targetDepth` (FR-CONSOL-02). */
export function cascadeDepths(targetDepth: 1 | 2 | 3): Array<1 | 2 | 3> {
  return Array.from({ length: targetDepth }, (_, i) => (i + 1) as 1 | 2 | 3);
}

export function advanceCounters(state: ConsolidationState, depth: 1 | 2 | 3, now?: Date): void {
  const timestamp = toLocalIsoStamp(now ?? new Date());
  clearDepthFailure(state, depth);
  switch (depth) {
    case 1:
      state.sessionsSinceLastDepth1 = 0;
      state.depth1RunsSinceLastDepth2 += 1;
      state.lastDepth1 = timestamp;
      break;
    case 2:
      state.depth1RunsSinceLastDepth2 = 0;
      state.depth2RunsSinceLastDepth3 += 1;
      state.lastDepth2 = timestamp;
      resetSkillUsagePeriod(state);
      break;
    case 3:
      state.depth2RunsSinceLastDepth3 = 0;
      state.lastDepth3 = timestamp;
      break;
  }
}

/** Increment session counter after an interactive session ends (FR-CONSOL-01). */
export function incrementSessionCounter(state: ConsolidationState): void {
  state.sessionsSinceLastDepth1 += 1;
}

function resetSkillUsagePeriod(state: ConsolidationState): void {
  if (!state.skillUsage) return;
  for (const name of Object.keys(state.skillUsage)) {
    const entry = state.skillUsage[name];
    if (!entry) continue;
    state.skillUsage[name] = { ...entry, invokedThisPeriod: 0 };
  }
}
