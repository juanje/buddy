// backends/session-lifecycle.ts — Session persistence loop (FR-GIT-01, FR-REFLECT-01/03).

import type { AgentEvent } from "../shared/api";
import { INCREMENTAL_REFLECT_EVERY } from "../shared/defaults";
import { toIsoDay } from "../shared/dates";
import { logEvent } from "./app-logger";
import { commitAll } from "./git";
import { savePendingSkeleton, shouldRunCheckpointReflect } from "./reflect";
import { spawnReflectChild, type SpawnReflectFn, type SpawnReflectOptions } from "./reflect-spawn";
import { SessionTracker } from "./session-tracker";

export type { SpawnReflectFn } from "./reflect-spawn";

export interface SessionLifecycleOptions {
  abDirectory: string;
  sessionId: string;
  sessionFile?: string;
  incrementalEvery?: number;
  spawnReflect?: SpawnReflectFn;
}

export class SessionLifecycle {
  readonly tracker: SessionTracker;
  private readonly abDirectory: string;
  private sessionFile: string | undefined;
  private readonly incrementalEvery: number;
  private readonly spawnReflect: SpawnReflectFn;
  private turnDirty = false;
  private reflectInFlight = false;
  private eventChain: Promise<void> = Promise.resolve();

  constructor(options: SessionLifecycleOptions) {
    this.abDirectory = options.abDirectory;
    this.sessionFile = options.sessionFile;
    this.tracker = new SessionTracker(options.sessionId);
    this.incrementalEvery = options.incrementalEvery ?? INCREMENTAL_REFLECT_EVERY;
    this.spawnReflect = options.spawnReflect ?? spawnReflectChild;
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
      const info = event.toolCall as { name?: string } | undefined;
      const name = info?.name ?? (event.toolName as string | undefined);
      if (name === "write" || name === "edit") this.turnDirty = true;
    }

    const flags = this.tracker.recordEvent(event, this.abDirectory);

    if (flags.compactionStart) {
      await this.runCheckpointReflect("compaction");
    }
    if (flags.turnEnded) {
      logEvent(this.abDirectory, {
        event: "turn_end",
        session: this.tracker.sessionId,
        turn: this.tracker.turnCount,
      });
      await this.onTurnEnd();
    }
  }

  async shutdown(): Promise<string | undefined> {
    const snapshot = this.tracker.toSnapshot();
    const pendingPath = savePendingSkeleton(this.abDirectory, snapshot);
    logEvent(this.abDirectory, {
      event: "session_end",
      session: this.tracker.sessionId,
      turns: snapshot.turnCount,
    });
    await commitAll(this.abDirectory, "ab: session end skeleton");

    this.requestReflect({
      mode: "session-end",
      logPath: pendingPath,
    });
    return pendingPath;
  }

  private async onTurnEnd(): Promise<void> {
    if (this.turnDirty) {
      const message = await commitAll(this.abDirectory);
      if (message) this.tracker.recordCommit(message);
      this.turnDirty = false;
    }

    if (
      shouldRunCheckpointReflect(
        this.tracker.turnCount,
        this.incrementalEvery,
        this.tracker.lastCheckpointTurn,
      )
    ) {
      await this.runCheckpointReflect("turn-threshold");
    }
  }

  private async runCheckpointReflect(_reason: "compaction" | "turn-threshold"): Promise<void> {
    if (this.reflectInFlight) return;
    if (!this.tracker.hasActivitySinceCheckpoint()) return;

    this.reflectInFlight = true;
    try {
      this.tracker.recordCheckpoint();
      const now = new Date();
      this.requestReflect({
        mode: "checkpoint",
        logPath: "",
        checkpointDate: toIsoDay(this.tracker.startTime),
        checkpointTime: now.toISOString().slice(11, 16),
      });
    } finally {
      this.reflectInFlight = false;
    }
  }

  private requestReflect(options: Omit<SpawnReflectOptions, "abDirectory" | "forkedSessionFile">): void {
    if (options.mode === "session-end") {
      logEvent(this.abDirectory, {
        event: "reflect_spawned",
        session: this.tracker.sessionId,
        mode: options.mode,
        pendingPath: options.logPath,
      });
    }
    this.spawnReflect({
      abDirectory: this.abDirectory,
      forkedSessionFile: this.sessionFile ?? "",
      ...options,
    });
  }
}
