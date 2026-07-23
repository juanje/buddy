// backends/session-lifecycle.ts — Session persistence loop (FR-GIT-01, FR-REFLECT-01/03).

import type { AgentEvent } from "../shared/api";
import { INCREMENTAL_REFLECT_EVERY } from "../shared/defaults";
import { formatLocalTime, toIsoDay } from "../shared/dates";
import { extractToolInfo } from "../shared/pi-events";
import { logEvent } from "./app-logger";
import { commitAll } from "./git";
import { createHebbianTracker, type HebbianTracker } from "./hebbian";
import { savePendingSkeleton, shouldRunCheckpointReflect } from "./reflect";
import { spawnReflectChild, type SpawnReflectFn, type SpawnReflectOptions } from "./reflect-spawn";
import { SessionTracker } from "./session-tracker";

export interface SessionLifecycleOptions {
  rootDir: string;
  sessionId: string;
  sessionFile?: string;
  incrementalEvery?: number;
  spawnReflect?: SpawnReflectFn;
  hebbianTracker?: HebbianTracker;
  /** Called after session-end reflect is spawned (FR-CONSOL-01 counter). */
  onSessionComplete?: (hadActivity: boolean) => void;
}

export class SessionLifecycle {
  readonly tracker: SessionTracker;
  readonly hebbianTracker: HebbianTracker;
  private readonly rootDir: string;
  private sessionFile: string | undefined;
  private readonly incrementalEvery: number;
  private readonly spawnReflect: SpawnReflectFn;
  private readonly onSessionComplete?: (hadActivity: boolean) => void;
  private turnDirty = false;
  private eventChain: Promise<void> = Promise.resolve();

  constructor(options: SessionLifecycleOptions) {
    this.rootDir = options.rootDir;
    this.sessionFile = options.sessionFile;
    this.tracker = new SessionTracker(options.sessionId);
    this.hebbianTracker = options.hebbianTracker ?? createHebbianTracker(options.rootDir);
    this.incrementalEvery = options.incrementalEvery ?? INCREMENTAL_REFLECT_EVERY;
    this.spawnReflect = options.spawnReflect ?? spawnReflectChild;
    this.onSessionComplete = options.onSessionComplete;
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
      if (name === "write" || name === "edit") this.turnDirty = true;
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

  async shutdown(): Promise<string | undefined> {
    const snapshot = this.tracker.toSnapshot();
    const pendingPath = savePendingSkeleton(this.rootDir, snapshot);
    logEvent(this.rootDir, {
      event: "session_end",
      session: this.tracker.sessionId,
      turns: snapshot.turnCount,
    });
    await commitAll(this.rootDir, "ab: session end skeleton");

    this.requestReflect({
      mode: "session-end",
      logPath: pendingPath,
    });
    this.onSessionComplete?.(snapshot.turnCount > 0);
    return pendingPath;
  }

  private async onTurnEnd(): Promise<void> {
    if (this.turnDirty) {
      await commitAll(this.rootDir);
      this.turnDirty = false;
    }

    if (
      shouldRunCheckpointReflect(
        this.tracker.turnCount,
        this.incrementalEvery,
        this.tracker.lastCheckpointTurn,
      )
    ) {
      await this.runCheckpointReflect();
    }
  }

  private async runCheckpointReflect(): Promise<void> {
    if (!this.tracker.hasActivitySinceCheckpoint()) return;

    this.tracker.recordCheckpoint();
    const now = new Date();
    this.requestReflect({
      mode: "checkpoint",
      logPath: "",
      checkpointDate: toIsoDay(this.tracker.startTime),
      checkpointTime: formatLocalTime(now.toISOString()),
    });
  }

  private requestReflect(options: Omit<SpawnReflectOptions, "rootDir" | "forkedSessionFile">): void {
    if (options.mode === "session-end") {
      logEvent(this.rootDir, {
        event: "reflect_spawned",
        session: this.tracker.sessionId,
        mode: options.mode,
        pendingPath: options.logPath,
      });
    }
    this.spawnReflect({
      rootDir: this.rootDir,
      forkedSessionFile: this.sessionFile ?? "",
      ...options,
    });
  }
}
