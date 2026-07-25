// backends/session-lifecycle.ts — Session persistence loop (FR-GIT-01, FR-REFLECT-02/03).

import type { AgentEvent } from "../shared/api";
import { formatLocalTime, toIsoDay } from "../shared/dates";
import { extractToolInfo } from "../shared/pi-events";
import { logEvent } from "./app-logger";
import { markReflectPending } from "./crash-recovery";
import { commitAll } from "./git";
import { createHebbianTracker, type HebbianTracker } from "./hebbian";
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
    if (event.type === "tool_execution_end") {
      const info = extractToolInfo(event);
      const name = info?.name;
      if (name === "write" || name === "edit" || name === "fetch_url") this.turnDirty = true;
      if (name === "read" && info?.path && event.isError !== true) {
        this.hebbianTracker.trackAccess(info.path);
      }
    }

    const flags = this.tracker.recordEvent(event, this.rootDir);

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

    markReflectPending(this.rootDir);

    this.requestReflect({
      mode: "session-end",
      sessionId: this.tracker.sessionId,
      sessionDate: toIsoDay(this.tracker.startTime),
      sessionStart: formatLocalTime(this.tracker.startTime.toISOString()),
      sessionEnd: formatLocalTime(now.toISOString()),
    });
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
