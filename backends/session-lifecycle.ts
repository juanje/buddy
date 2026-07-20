// backends/session-lifecycle.ts — Session persistence loop (FR-GIT-01, FR-REFLECT-01/03).

import type { AgentEvent } from "../shared/api";
import { INCREMENTAL_REFLECT_EVERY } from "../shared/defaults";
import { logEvent } from "./app-logger";
import { commitAll } from "./git";
import {
  cleanupSnapshots,
  listSnapshots,
  saveIncrementalSnapshot,
  savePendingSkeleton,
  shouldRunIncrementalReflect,
} from "./reflect";
import { spawnReflectChild } from "./reflect-spawn";
import { SessionTracker } from "./session-tracker";

export interface SessionLifecycleOptions {
  abDirectory: string;
  sessionId: string;
  sessionFile?: string;
  incrementalEvery?: number;
}

export class SessionLifecycle {
  readonly tracker: SessionTracker;
  private readonly abDirectory: string;
  private sessionFile: string | undefined;
  private readonly incrementalEvery: number;
  private turnDirty = false;
  private reflectInFlight = false;
  private eventChain: Promise<void> = Promise.resolve();

  constructor(options: SessionLifecycleOptions) {
    this.abDirectory = options.abDirectory;
    this.sessionFile = options.sessionFile;
    this.tracker = new SessionTracker(options.sessionId);
    this.incrementalEvery = options.incrementalEvery ?? INCREMENTAL_REFLECT_EVERY;
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
      await this.runIncrementalReflect("compaction");
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
    snapshot.snapshots = listSnapshots(this.abDirectory, this.tracker.sessionId).map(
      (name) => `.ab-app/snapshots/${name}`,
    );
    const pendingPath = savePendingSkeleton(this.abDirectory, snapshot);
    logEvent(this.abDirectory, {
      event: "session_end",
      session: this.tracker.sessionId,
      turns: snapshot.turnCount,
    });
    await commitAll(this.abDirectory, "ab: session end skeleton");
    cleanupSnapshots(this.abDirectory, this.tracker.sessionId);

    this.spawnReflect(pendingPath, "session-end");
    return pendingPath;
  }

  private async onTurnEnd(): Promise<void> {
    if (this.turnDirty) {
      const message = await commitAll(this.abDirectory);
      if (message) this.tracker.recordCommit(message);
      this.turnDirty = false;
    }

    if (
      shouldRunIncrementalReflect(
        this.tracker.turnCount,
        this.incrementalEvery,
        this.tracker.lastSnapshotTurn,
      )
    ) {
      await this.runIncrementalReflect("turn-threshold");
    }
  }

  private async runIncrementalReflect(_reason: "compaction" | "turn-threshold"): Promise<void> {
    if (this.reflectInFlight) return;
    const segment = this.tracker.getSegment();
    const hasActivity =
      segment.filesRead.length > 0 ||
      segment.filesWritten.length > 0 ||
      segment.toolCalls.length > 0;
    if (!hasActivity) return;

    this.reflectInFlight = true;
    try {
      const path = saveIncrementalSnapshot(
        this.abDirectory,
        this.tracker.sessionId,
        this.tracker.turnCount,
        segment,
      );
      this.tracker.snapshots.push(path.replace(`${this.abDirectory}/`, ""));
      this.tracker.resetSegment();
      await commitAll(this.abDirectory, "ab: incremental reflect snapshot");

      this.spawnReflect(path, "incremental");
    } finally {
      this.reflectInFlight = false;
    }
  }

  private spawnReflect(pendingPath: string, mode: "session-end" | "incremental"): void {
    const forkedSessionFile = this.sessionFile ?? "";
    if (mode === "session-end") {
      logEvent(this.abDirectory, {
        event: "reflect_spawned",
        session: this.tracker.sessionId,
        mode,
        pendingPath,
      });
    }
    spawnReflectChild({
      abDirectory: this.abDirectory,
      forkedSessionFile,
      logPath: pendingPath,
      mode,
    });
  }
}
