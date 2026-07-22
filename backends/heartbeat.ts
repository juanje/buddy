// backends/heartbeat.ts — Periodic deferred + consolidation checks (FR-DEFERRED-02, FR-CONSOL-01/05).

import type { ModelRuntime } from "@earendil-works/pi-coding-agent";

import type { DeferredItemView } from "../shared/api";
import { HEARTBEAT_INTERVAL_MS } from "../shared/defaults";
import {
  determineTargetDepth,
  incrementSessionCounter,
  loadConsolidationState,
  saveConsolidationState,
  type ConsolidationState,
} from "../shared/consolidation-state";
import { toIsoDay } from "../shared/dates";
import { hasNewContentSinceConsolidation } from "./consolidation-content";
import { runConsolidation } from "./consolidation-runner";
import { getDueDeferred } from "./deferred";

export interface HeartbeatDeps {
  abDirectory: string;
  modelRuntime: ModelRuntime;
  isStreaming: () => boolean;
  onDeferredDue: (items: DeferredItemView[]) => void;
  onConsolidationStart?: (depth: number) => void;
  onConsolidationEnd?: (depth: number, status: "success" | "fail" | "skipped") => void;
  intervalMs?: number;
  now?: () => Date;
  runConsolidationFn?: typeof runConsolidation;
  hasNewContentFn?: (abDirectory: string, state: ConsolidationState) => Promise<boolean>;
}

export interface HeartbeatHandle {
  stop: () => void;
  tick: () => Promise<void>;
  incrementSessionCounter: (hadActivity?: boolean) => void;
  getState: () => ConsolidationState;
}

function toDeferredViews(
  items: ReturnType<typeof getDueDeferred>,
  today: string,
): DeferredItemView[] {
  return items.map((item) => ({
    type: item.type,
    dueDate: item.dueDate,
    source: item.source,
    text: item.text,
    overdue: item.dueDate < today,
  }));
}

export function startHeartbeat(deps: HeartbeatDeps): HeartbeatHandle {
  const intervalMs = deps.intervalMs ?? HEARTBEAT_INTERVAL_MS;
  const nowFn = deps.now ?? (() => new Date());
  const runConsolidationImpl = deps.runConsolidationFn ?? runConsolidation;
  const hasNewContentImpl = deps.hasNewContentFn ?? hasNewContentSinceConsolidation;
  let state = loadConsolidationState(deps.abDirectory);
  let consolidationInFlight = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  async function evaluateConsolidation(): Promise<void> {
    if (consolidationInFlight) return;
    if (deps.isStreaming()) return;

    const targetDepth = determineTargetDepth(state);
    if (!targetDepth) return;

    if (!(await hasNewContentImpl(deps.abDirectory, state))) return;

    consolidationInFlight = true;
    deps.onConsolidationStart?.(targetDepth);
    try {
      const result = await runConsolidationImpl({
        abDirectory: deps.abDirectory,
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

  async function tick(): Promise<void> {
    if (!consolidationInFlight) {
      state = loadConsolidationState(deps.abDirectory);
    }
    const now = nowFn();
    const today = toIsoDay(now);
    const dueItems = getDueDeferred(deps.abDirectory, now);
    if (dueItems.length > 0) {
      deps.onDeferredDue(toDeferredViews(dueItems, today));
    }
    await evaluateConsolidation();
  }

  timer = setInterval(() => {
    void tick();
  }, intervalMs);

  void tick();

  return {
    stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
    },
    tick,
    incrementSessionCounter(hadActivity = true) {
      if (!hadActivity) return;
      incrementSessionCounter(state);
      saveConsolidationState(deps.abDirectory, state);
    },
    getState() {
      return { ...state };
    },
  };
}
