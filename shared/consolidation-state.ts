// shared/consolidation-state.ts — Consolidation counters and run journal (FR-CONSOL-01/06).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  CONSOLIDATION_LOG_PATH,
  CONSOLIDATION_STATE_PATH,
} from "./defaults";
import { MS_PER_HOUR } from "./dates";

export interface ConsolidationState {
  sessionsSinceLastDepth1: number;
  depth1RunsSinceLastDepth2: number;
  depth2RunsSinceLastDepth3: number;
  lastDepth1: string | null;
  lastDepth2: string | null;
  lastDepth3: string | null;
  /** Path to the live Pi session file (FR-REFLECT-05). */
  liveSessionFile?: string | null;
  /** True when session-end reflect was requested but may not have completed. */
  reflectPending?: boolean;
}

export interface ConsolidationLogEntry {
  timestamp: string;
  depth: number;
  duration_ms: number;
  status: "success" | "fail";
  error?: string;
}

export const CONSOLIDATION_THRESHOLDS = {
  depth1: { sessions: 3, maxHours: 24 },
  depth2: { depth1Runs: 5 },
  depth3: { depth2Runs: 4 },
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

export function stateFilePath(rootDir: string): string {
  return join(rootDir, CONSOLIDATION_STATE_PATH);
}

export function logFilePath(rootDir: string): string {
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

/**
 * Depth-1 uses a hybrid trigger: fires when EITHER the session count threshold
 * is met OR enough hours have elapsed since the last run (with at least 1 session
 * of new content). This prevents stale content from sitting unconsolidated when
 * the user has few but long sessions.
 */
export function isDepthDue(depth: 1 | 2 | 3, state: ConsolidationState, now?: Date): boolean {
  switch (depth) {
    case 1: {
      const sessionsDue = state.sessionsSinceLastDepth1 >= CONSOLIDATION_THRESHOLDS.depth1.sessions;
      const timeDue =
        state.lastDepth1 !== null &&
        state.sessionsSinceLastDepth1 > 0 &&
        hoursSince(state.lastDepth1, now ?? new Date()) >= CONSOLIDATION_THRESHOLDS.depth1.maxHours;
      return sessionsDue || timeDue;
    }
    case 2:
      return state.depth1RunsSinceLastDepth2 >= CONSOLIDATION_THRESHOLDS.depth2.depth1Runs;
    case 3:
      return state.depth2RunsSinceLastDepth3 >= CONSOLIDATION_THRESHOLDS.depth3.depth2Runs;
  }
}

/** Highest consolidation depth whose usage threshold is met, or null. */
export function determineTargetDepth(state: ConsolidationState, now?: Date): 1 | 2 | 3 | null {
  if (isDepthDue(3, state, now)) return 3;
  if (isDepthDue(2, state, now)) return 2;
  if (isDepthDue(1, state, now)) return 1;
  return null;
}

/** Depths to run in cascade order when consolidating at `targetDepth` (FR-CONSOL-02). */
export function cascadeDepths(targetDepth: 1 | 2 | 3): Array<1 | 2 | 3> {
  return Array.from({ length: targetDepth }, (_, i) => (i + 1) as 1 | 2 | 3);
}

export function advanceCounters(state: ConsolidationState, depth: 1 | 2 | 3, now?: Date): void {
  const timestamp = (now ?? new Date()).toISOString();
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
