// backends/session-tracker.ts — In-memory session event accumulator (FR-REFLECT-01/03).

import type { AgentEvent } from "../shared/api";
import { extractToolInfo } from "../shared/pi-events";
import { READ_TOOLS, WRITE_TOOLS } from "../shared/defaults";
import { sep } from "node:path";

export interface TrackedToolCall {
  name: string;
  path?: string;
  timestamp: string;
}

export interface SessionTrackerSnapshot {
  sessionId: string;
  startTime: string;
  endTime: string;
  turnCount: number;
  filesRead: string[];
  filesWritten: string[];
  toolCalls: TrackedToolCall[];
  commits: string[];
}

function relPath(abDirectory: string, absOrRel: string): string {
  if (absOrRel === abDirectory) return absOrRel;
  const prefix = abDirectory.endsWith(sep) ? abDirectory : abDirectory + sep;
  if (!absOrRel.startsWith(prefix)) return absOrRel;
  return absOrRel.slice(prefix.length) || absOrRel;
}

export class SessionTracker {
  readonly sessionId: string;
  readonly startTime: Date;
  turnCount = 0;
  filesRead: string[] = [];
  filesWritten: string[] = [];
  toolCalls: TrackedToolCall[] = [];
  commits: string[] = [];
  lastCheckpointTurn = 0;

  private activitySinceCheckpoint = false;
  private pendingArgs = new Map<string, { name: string; path?: string }>();

  constructor(sessionId: string, startTime: Date = new Date()) {
    this.sessionId = sessionId;
    this.startTime = startTime;
  }

  recordCommit(message: string): void {
    this.commits.push(message);
  }

  recordEvent(event: AgentEvent, abDirectory: string): {
    turnEnded: boolean;
    compactionStart: boolean;
  } {
    if (event.type === "tool_execution_start") {
      const toolCallId = event.toolCallId as string | undefined;
      const info = extractToolInfo(event);
      if (toolCallId && info) {
        this.pendingArgs.set(toolCallId, info);
      }
    }
    if (event.type === "tool_execution_end") {
      this.trackToolEnd(event, abDirectory);
    }
    if (event.type === "agent_end") {
      this.turnCount += 1;
      return { turnEnded: true, compactionStart: false };
    }
    if (event.type === "compaction_start") {
      return { turnEnded: false, compactionStart: true };
    }
    return { turnEnded: false, compactionStart: false };
  }

  hasActivitySinceCheckpoint(): boolean {
    return this.activitySinceCheckpoint;
  }

  recordCheckpoint(): void {
    this.lastCheckpointTurn = this.turnCount;
    this.activitySinceCheckpoint = false;
  }

  toSnapshot(endTime: Date = new Date()): SessionTrackerSnapshot {
    return {
      sessionId: this.sessionId,
      startTime: this.startTime.toISOString(),
      endTime: endTime.toISOString(),
      turnCount: this.turnCount,
      filesRead: [...this.filesRead],
      filesWritten: [...this.filesWritten],
      toolCalls: [...this.toolCalls],
      commits: [...this.commits],
    };
  }

  private trackToolEnd(event: AgentEvent, abDirectory: string): void {
    const toolCallId = event.toolCallId as string | undefined;
    const endInfo = extractToolInfo(event);
    const startInfo = toolCallId ? this.pendingArgs.get(toolCallId) : undefined;
    if (toolCallId) this.pendingArgs.delete(toolCallId);

    const name = endInfo?.name ?? startInfo?.name;
    if (!name) return;

    const path = startInfo?.path ?? endInfo?.path;
    const timestamp = new Date().toISOString();
    const relP = path ? relPath(abDirectory, path) : undefined;
    const entry: TrackedToolCall = { name, path: relP, timestamp };
    this.toolCalls.push(entry);
    this.activitySinceCheckpoint = true;

    if (relP && READ_TOOLS.has(name)) {
      this.pushUnique(this.filesRead, relP);
    }
    if (relP && WRITE_TOOLS.has(name)) {
      this.pushUnique(this.filesWritten, relP);
    }
  }

  private pushUnique(list: string[], value: string): void {
    if (!list.includes(value)) list.push(value);
  }
}
