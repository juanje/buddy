// backends/heartbeat.ts — Periodic deferred + consolidation checks (FR-DEFERRED-02, FR-CONSOL-01/05).

import type { ModelRuntime } from "@earendil-works/pi-coding-agent";

import type { DeferredItemView } from "../shared/api";
import { HEARTBEAT_INTERVAL_MS, HEARTBEAT_MIN_TICK_MS } from "../shared/defaults";
import {
  determineTargetDepth,
  incrementSessionCounter,
  loadConsolidationState,
  saveConsolidationState,
  type ConsolidationState,
} from "../shared/consolidation-state";
import { logEvent } from "./app-logger";
import { hasNewContentSinceConsolidation } from "./consolidation-content";
import { runConsolidation } from "./consolidation-runner";
import { getDueDeferred, toDeferredItemViews, toIsoDay } from "./deferred";

export interface HeartbeatDeps {
  rootDir: string;
  modelRuntime: ModelRuntime;
  isStreaming: () => boolean;
  onDeferredDue: (items: DeferredItemView[]) => void;
  onConsolidationStart?: (depth: number) => void;
  onConsolidationEnd?: (depth: number, status: "success" | "fail" | "skipped") => void;
  intervalMs?: number;
  now?: () => Date;
  runConsolidationFn?: typeof runConsolidation;
  hasNewContentFn?: (rootDir: string, state: ConsolidationState) => Promise<boolean>;
}

export interface HeartbeatHandle {
  stop: () => void;
  tick: () => Promise<void>;
  incrementSessionCounter: (hadActivity?: boolean) => void;
  getState: () => ConsolidationState;
}

export function startHeartbeat(deps: HeartbeatDeps): HeartbeatHandle {
  const intervalMs = deps.intervalMs ?? HEARTBEAT_INTERVAL_MS;
  const nowFn = deps.now ?? (() => new Date());
  const runConsolidationImpl = deps.runConsolidationFn ?? runConsolidation;
  const hasNewContentImpl = deps.hasNewContentFn ?? hasNewContentSinceConsolidation;
  let state = loadConsolidationState(deps.rootDir);
  let consolidationInFlight = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let lastTickAt = 0;

  async function evaluateConsolidation(): Promise<void> {
    if (consolidationInFlight) return;
    if (deps.isStreaming()) return;

    const targetDepth = determineTargetDepth(state, nowFn());
    if (!targetDepth) return;

    if (!(await hasNewContentImpl(deps.rootDir, state))) return;

    consolidationInFlight = true;
    deps.onConsolidationStart?.(targetDepth);
    try {
      const result = await runConsolidationImpl({
        rootDir: deps.rootDir,
        targetDepth,
        modelRuntime: deps.modelRuntime,
        state,
        now: nowFn(),
      });
      state = result.state;
      if (result.ran) {
        deps.onConsolidationEnd?.(targetDepth, "success");
      } else {
        deps.onConsolidationEnd?.(targetDepth, "skipped");
      }
    } catch {
      deps.onConsolidationEnd?.(targetDepth, "fail");
    } finally {
      consolidationInFlight = false;
    }
  }

  async function tickInner(): Promise<void> {

    if (!consolidationInFlight) {
      state = loadConsolidationState(deps.rootDir);
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

  if (typeof process !== "undefined" && process.env.AB_DEBUG) {
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
    getState() {
      return { ...state };
    },
  };
}
