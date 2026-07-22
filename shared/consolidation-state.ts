// shared/consolidation-state.ts — Consolidation counters and run journal (FR-CONSOL-01/06).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  CONSOLIDATION_LOG_PATH,
  CONSOLIDATION_STATE_PATH,
} from "./defaults";

export interface ConsolidationState {
  sessionsSinceLastDepth1: number;
  depth1RunsSinceLastDepth2: number;
  depth2RunsSinceLastDepth3: number;
  lastDepth1: string | null;
  lastDepth2: string | null;
  lastDepth3: string | null;
}

export interface ConsolidationLogEntry {
  timestamp: string;
  depth: number;
  duration_ms: number;
  status: "success" | "fail";
  error?: string;
}

export const CONSOLIDATION_THRESHOLDS = {
  depth1: { sessions: 3 },
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
  };
}

export function stateFilePath(abDirectory: string): string {
  return join(abDirectory, CONSOLIDATION_STATE_PATH);
}

export function logFilePath(abDirectory: string): string {
  return join(abDirectory, CONSOLIDATION_LOG_PATH);
}

export function loadConsolidationState(abDirectory: string): ConsolidationState {
  const path = stateFilePath(abDirectory);
  if (!existsSync(path)) return defaultConsolidationState();
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<ConsolidationState>;
    return { ...defaultConsolidationState(), ...parsed };
  } catch {
    return defaultConsolidationState();
  }
}

export function saveConsolidationState(abDirectory: string, state: ConsolidationState): void {
  const path = stateFilePath(abDirectory);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2) + "\n");
}

export function loadConsolidationLog(abDirectory: string): ConsolidationLogEntry[] {
  const path = logFilePath(abDirectory);
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as ConsolidationLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendConsolidationLogEntry(
  abDirectory: string,
  entry: ConsolidationLogEntry,
): void {
  const path = logFilePath(abDirectory);
  const log = loadConsolidationLog(abDirectory);
  log.push(entry);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(log, null, 2) + "\n");
}

export function isDepthDue(depth: 1 | 2 | 3, state: ConsolidationState): boolean {
  switch (depth) {
    case 1:
      return state.sessionsSinceLastDepth1 >= CONSOLIDATION_THRESHOLDS.depth1.sessions;
    case 2:
      return state.depth1RunsSinceLastDepth2 >= CONSOLIDATION_THRESHOLDS.depth2.depth1Runs;
    case 3:
      return state.depth2RunsSinceLastDepth3 >= CONSOLIDATION_THRESHOLDS.depth3.depth2Runs;
  }
}

/** Highest consolidation depth whose usage threshold is met, or null. */
export function determineTargetDepth(state: ConsolidationState): 1 | 2 | 3 | null {
  if (isDepthDue(3, state)) return 3;
  if (isDepthDue(2, state)) return 2;
  if (isDepthDue(1, state)) return 1;
  return null;
}

/** Depths to run in cascade order when consolidating at `targetDepth` (FR-CONSOL-02). */
export function cascadeDepths(targetDepth: 1 | 2 | 3): Array<1 | 2 | 3> {
  const depths: Array<1 | 2 | 3> = [];
  for (let d = 1 as 1 | 2 | 3; d <= targetDepth; d++) {
    depths.push(d);
  }
  return depths;
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
