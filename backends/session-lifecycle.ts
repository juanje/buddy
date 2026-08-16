// backends/session-lifecycle.ts — Session persistence loop (FR-GIT-01, FR-REFLECT-02/03).

import type { AgentEvent } from "../shared/api";
import { formatLocalTime, toIsoDay } from "../shared/dates";
import { extractToolInfo } from "../shared/pi-events";
import { logEvent } from "./app-logger";
import { markReflectPending } from "./crash-recovery";
import { commitAll } from "./git";
import { createHebbianTracker, isFileConsultation, type HebbianTracker } from "./hebbian";
import { createHebbianGuard, type HebbianGuard } from "./hebbian-guard";
import { spawnReflectChild, type SpawnReflectFn, type SpawnReflectOptions } from "./reflect-spawn";
import { SessionTracker } from "./session-tracker";

export interface SessionLifecycleOptions {
  rootDir: string;
  sessionId: string;
  sessionFile?: string;
  spawnReflect?: SpawnReflectFn;
  hebbianTracker?: HebbianTracker;
  /** Called after session-end reflect is spawned (FR-CONSOL-01 counter). */
  onSessionComplete?: (hadActivity: boolean) => void;
  /** Skip checkpoint reflects when monthly budget is near limit (FR-COST-03). */
  isBudgetNearLimit?: () => boolean;
}

export class SessionLifecycle {
  readonly tracker: SessionTracker;
  readonly hebbianTracker: HebbianTracker;
  /** FR-HEBB-06: keeps a whole-file rewrite from resetting the counters. */
  private readonly hebbianGuard: HebbianGuard;
  private readonly rootDir: string;
  private sessionFile: string | undefined;
  private readonly spawnReflect: SpawnReflectFn;
  private readonly onSessionComplete?: (hadActivity: boolean) => void;
  private readonly isBudgetNearLimit?: () => boolean;
  private turnDirty = false;
  private eventChain: Promise<void> = Promise.resolve();

  constructor(options: SessionLifecycleOptions) {
    this.rootDir = options.rootDir;
    this.sessionFile = options.sessionFile;
    this.tracker = new SessionTracker(options.sessionId);
    this.hebbianTracker = options.hebbianTracker ?? createHebbianTracker(options.rootDir);
    this.hebbianGuard = createHebbianGuard(options.rootDir);
    this.spawnReflect = options.spawnReflect ?? spawnReflectChild;
    this.onSessionComplete = options.onSessionComplete;
    this.isBudgetNearLimit = options.isBudgetNearLimit;
  }

  setSessionFile(path: string): void {
    this.sessionFile = path;
  }

  handleEvent(event: AgentEvent): Promise<void> {
    this.eventChain = this.eventChain.then(() => this.handleEventInner(event));
    return this.eventChain;
  }

  /** Wait until all queued lifecycle events have finished (tests + shutdown). */
  async flush(): Promise<void> {
    await this.eventChain;
  }

  private async handleEventInner(event: AgentEvent): Promise<void> {
    // FR-HEBB-06: snapshot the worker-owned counters before the tool runs, so
    // a whole-file rewrite that reconstructs frontmatter from memory can be
    // put back. Capturing after the fact would read the damage.
    if (event.type === "tool_execution_start") {
      const info = extractToolInfo(event);
      if ((info?.name === "write" || info?.name === "edit") && info.path) {
        this.hebbianGuard.capture(info.path);
      }
    }

    const flags = this.tracker.recordEvent(event, this.rootDir);

    // FR-HEBB-07: the path comes from `finishedTool`, which the tracker pairs
    // with the start event. `tool_execution_end` has no `args` of its own, so
    // reading it directly left `path` undefined and every access check failed
    // its guard in silence — while the `turnDirty` flags below kept working,
    // because they only test the tool name. Auto-commit therefore looked
    // healthy while nothing was ever tracked.
    const finished = flags.finishedTool;
    if (finished) {
      const { name, path } = finished;
      logEvent(this.rootDir, {
        event: "tool_result",
        session: this.tracker.sessionId,
        tool: name,
        path: path ?? undefined,
        isError: event.isError === true,
      });
      if (name === "write" || name === "edit" || name === "fetch_url") this.turnDirty = true;
      if (event.isError !== true) {
        if ((name === "write" || name === "edit") && path) {
          this.hebbianGuard.restore(path);
        }
        if (isFileConsultation(name, path, this.rootDir)) this.hebbianTracker.trackAccess(path!);
      }
    }

    if (flags.compactionStart) {
      await this.runCheckpointReflect();
    }
    if (flags.turnEnded) {
      logEvent(this.rootDir, {
        event: "turn_end",
        session: this.tracker.sessionId,
        turn: this.tracker.turnCount,
      });
      if (this.hebbianTracker.flush()) this.turnDirty = true;
      await this.onTurnEnd();
    }
  }

  async shutdown(): Promise<void> {
    const snapshot = this.tracker.toSnapshot();
    const now = new Date();
    logEvent(this.rootDir, {
      event: "session_end",
      session: this.tracker.sessionId,
      turns: snapshot.turnCount,
    });

    if (snapshot.turnCount > 0) {
      markReflectPending(this.rootDir);

      this.requestReflect({
        mode: "session-end",
        sessionId: this.tracker.sessionId,
        sessionDate: toIsoDay(this.tracker.startTime),
        sessionStart: formatLocalTime(this.tracker.startTime.toISOString()),
        sessionEnd: formatLocalTime(now.toISOString()),
      });
    }
    this.onSessionComplete?.(snapshot.turnCount > 0);
  }

  private async onTurnEnd(): Promise<void> {
    if (this.turnDirty) {
      await commitAll(this.rootDir);
      this.turnDirty = false;
    }
  }

  private async runCheckpointReflect(): Promise<void> {
    if (!this.tracker.hasActivitySinceCheckpoint()) return;

    this.tracker.recordCheckpoint();
    const now = new Date();
    this.requestReflect({
      mode: "checkpoint",
      sessionId: this.tracker.sessionId,
      sessionDate: toIsoDay(this.tracker.startTime),
      sessionStart: formatLocalTime(this.tracker.startTime.toISOString()),
      sessionEnd: formatLocalTime(now.toISOString()),
      checkpointDate: toIsoDay(this.tracker.startTime),
      checkpointTime: formatLocalTime(now.toISOString()),
    });
  }

  private requestReflect(options: Omit<SpawnReflectOptions, "rootDir" | "forkedSessionFile">): void {
    if (options.mode !== "session-end" && this.isBudgetNearLimit?.()) {
      return;
    }
    if (options.mode === "session-end") {
      logEvent(this.rootDir, {
        event: "reflect_spawned",
        session: this.tracker.sessionId,
        mode: options.mode,
      });
    }
    this.spawnReflect({
      rootDir: this.rootDir,
      forkedSessionFile: this.sessionFile ?? "",
      ...options,
    });
  }
}
