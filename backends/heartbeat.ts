// backends/heartbeat.ts — Periodic deferred + consolidation checks (FR-DEFERRED-02, FR-CONSOL-01/05).

import type { ModelRuntime } from "@earendil-works/pi-coding-agent";

import type { DeferredItemView } from "../shared/api";
import { HEARTBEAT_INTERVAL_MS, HEARTBEAT_MIN_TICK_MS, LEGACY_DEBUG_ENV } from "../shared/defaults";
import {
  depthBlockReason,
  determineTargetDepth,
  incrementSessionCounter,
  isDepthDue,
  loadConsolidationState,
  saveConsolidationState,
  type ConsolidationState,
} from "../shared/consolidation-state";
import { logEvent } from "./app-logger";
import { hasNewContentSinceConsolidation } from "./consolidation-content";
import { runConsolidation } from "./consolidation-runner";
import { getDueDeferred, toDeferredItemViews } from "./deferred";
import { evaluateWikiHealth, type WikiHealthEvalResult } from "./wiki-heartbeat";
import { loadWikiState, saveWikiState, type WikiMaintenanceState } from "../shared/wiki-state";
import { pruneSessionArtifacts } from "./session-log-prune";
import { toIsoDay } from "../shared/dates";

export interface HeartbeatDeps {
  rootDir: string;
  modelRuntime: ModelRuntime;
  isStreaming: () => boolean;
  onDeferredDue: (items: DeferredItemView[]) => void;
  onConsolidationStart?: (depth: number) => void;
  onConsolidationEnd?: (depth: number, status: "success" | "fail" | "skipped") => void;
  /** A depth hit the retry ceiling and will not be retried (FR-CONSOL-09). */
  onMaintenancePaused?: (depth: number) => void;
  isBudgetNearLimit?: () => boolean;
  intervalMs?: number;
  now?: () => Date;
  runConsolidationFn?: typeof runConsolidation;
  hasNewContentFn?: (rootDir: string, state: ConsolidationState) => Promise<boolean>;
  evaluateWikiHealthFn?: (
    rootDir: string,
    state: WikiMaintenanceState,
  ) => Promise<WikiHealthEvalResult>;
}

export interface HeartbeatHandle {
  stop: () => void;
  tick: () => Promise<void>;
  incrementSessionCounter: (hadActivity?: boolean) => void;
}

export function startHeartbeat(deps: HeartbeatDeps): HeartbeatHandle {
  const intervalMs = deps.intervalMs ?? HEARTBEAT_INTERVAL_MS;
  const nowFn = deps.now ?? (() => new Date());
  const runConsolidationImpl = deps.runConsolidationFn ?? runConsolidation;
  const hasNewContentImpl = deps.hasNewContentFn ?? hasNewContentSinceConsolidation;
  const evaluateWikiHealthImpl = deps.evaluateWikiHealthFn ?? evaluateWikiHealth;
  let state = loadConsolidationState(deps.rootDir);
  let wikiState = loadWikiState(deps.rootDir);
  let consolidationInFlight = false;
  let wikiHealthInFlight = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let lastTickAt = 0;
  let prunedThisBoot = false;
  const pausedNotified = new Set<number>();

  async function evaluateConsolidation(): Promise<void> {
    if (consolidationInFlight) return;
    if (deps.isStreaming()) return;

    const targetDepth = determineTargetDepth(state, nowFn());
    if (!targetDepth) {
      // Work is waiting but every candidate depth is abandoned. Notify here as
      // well as at the moment of failure: otherwise a user whose app restarted
      // after the final failure would never learn maintenance had stopped.
      reportAbandonedWork();
      return;
    }

    if (!(await hasNewContentImpl(deps.rootDir, state))) return;
    if (deps.isBudgetNearLimit?.()) return;

    consolidationInFlight = true;
    deps.onConsolidationStart?.(targetDepth);
    try {
      const result = await runConsolidationImpl({
        rootDir: deps.rootDir,
        targetDepth,
        modelRuntime: deps.modelRuntime,
        state,
        now: nowFn(),
        isBudgetNearLimit: deps.isBudgetNearLimit,
      });
      state = result.state;
      // FR-CONSOL-09: tell the user once a depth is abandoned. Silence here is
      // what turned a broken depth into an unnoticed budget drain.
      for (const depth of result.abandonedDepths) {
        notifyMaintenancePaused(depth);
      }
      if (result.stoppedBy === "failure") {
        deps.onConsolidationEnd?.(targetDepth, "fail");
      } else if (result.ran) {
        deps.onConsolidationEnd?.(targetDepth, "success");
      } else {
        deps.onConsolidationEnd?.(targetDepth, "skipped");
      }
    } catch {
      // The runner handles per-depth failures internally; reaching here means
      // the cascade could not start at all (session creation, lock, disk).
      deps.onConsolidationEnd?.(targetDepth, "fail");
    } finally {
      consolidationInFlight = false;
    }
  }

  /** Depths that are due but permanently blocked — pending work nobody will do. */
  function reportAbandonedWork(): void {
    const at = nowFn();
    for (const depth of [1, 2, 3] as const) {
      if (isDepthDue(depth, state, at) && depthBlockReason(state, depth, at) === "abandoned") {
        notifyMaintenancePaused(depth);
      }
    }
  }

  /** Fire the pause notice at most once per depth per app run. */
  function notifyMaintenancePaused(depth: number): void {
    if (pausedNotified.has(depth)) return;
    pausedNotified.add(depth);
    logEvent(deps.rootDir, { event: "consolidation_abandoned", depth });
    deps.onMaintenancePaused?.(depth);
  }

  async function evaluateWikiHealthTask(): Promise<void> {
    if (wikiHealthInFlight) return;
    wikiHealthInFlight = true;
    try {
      const result = await evaluateWikiHealthImpl(deps.rootDir, wikiState);
      wikiState = result.state;
      saveWikiState(deps.rootDir, wikiState);
    } catch (error) {
      logEvent(deps.rootDir, {
        event: "wiki_health_error",
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      wikiHealthInFlight = false;
    }
  }

  async function tickInner(): Promise<void> {
    if (!prunedThisBoot) {
      pruneSessionArtifacts(deps.rootDir);
      prunedThisBoot = true;
    }

    if (!consolidationInFlight) {
      state = loadConsolidationState(deps.rootDir);
      wikiState = loadWikiState(deps.rootDir);
    }
    const now = nowFn();
    const today = toIsoDay(now);
    const dueItems = getDueDeferred(deps.rootDir, now);
    if (dueItems.length > 0) {
      deps.onDeferredDue(toDeferredItemViews(dueItems, today));
    }
    const willEvaluateConsolidation = !consolidationInFlight && !deps.isStreaming();
    logEvent(deps.rootDir, {
      event: "heartbeat_tick",
      deferredDue: dueItems.length,
      consolidationEvaluated: willEvaluateConsolidation,
    }, now);
    await evaluateConsolidation();
    await evaluateWikiHealthTask();
  }

  // Rate-limited tick for setInterval — guards against runaway timer
  // (sub-second repetition seen in Bun compiled binaries where the interval
  // resolves to 0 or undefined).
  function guardedTick(): void {
    const nowMs = Date.now();
    if (nowMs - lastTickAt < HEARTBEAT_MIN_TICK_MS) return;
    lastTickAt = nowMs;
    void tickInner();
  }

  if (typeof process !== "undefined" && (process.env.BUDDY_DEBUG || process.env[LEGACY_DEBUG_ENV])) {
    console.error(`[heartbeat] starting with interval=${intervalMs}ms`);
  }
  timer = setInterval(guardedTick, intervalMs);

  void tickInner();

  return {
    stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
    },
    tick: tickInner,
    incrementSessionCounter(hadActivity = true) {
      if (!hadActivity) return;
      incrementSessionCounter(state);
      saveConsolidationState(deps.rootDir, state);
    },
  };
}
