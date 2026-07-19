// backends/session-tracker.ts — In-memory session event accumulator (FR-REFLECT-01/03).

import type { AgentEvent } from "../shared/api";

const WRITE_TOOLS = new Set(["write", "edit"]);
const READ_TOOLS = new Set(["read", "ls", "find", "grep"]);

export interface TrackedToolCall {
  name: string;
  path?: string;
  timestamp: string;
}

export interface SessionSegment {
  filesRead: string[];
  filesWritten: string[];
  toolCalls: TrackedToolCall[];
  startTurn: number;
  endTurn: number;
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
  snapshots: string[];
}

function extractToolInfo(event: AgentEvent): { name: string; path?: string } | null {
  const toolCall = event.toolCall as { name?: string; args?: { path?: string } } | undefined;
  const name = toolCall?.name ?? (event.toolName as string | undefined);
  if (!name) return null;
  const path = toolCall?.args?.path;
  return { name, path: typeof path === "string" ? path : undefined };
}

function relPath(abDirectory: string, absOrRel: string): string {
  if (!absOrRel.startsWith(abDirectory)) return absOrRel;
  const trimmed = absOrRel.slice(abDirectory.length).replace(/^[/\\]/, "");
  return trimmed || absOrRel;
}

export class SessionTracker {
  readonly sessionId: string;
  readonly startTime: Date;
  turnCount = 0;
  filesRead: string[] = [];
  filesWritten: string[] = [];
  toolCalls: TrackedToolCall[] = [];
  commits: string[] = [];
  snapshots: string[] = [];
  lastSnapshotTurn = 0;

  private segmentRead: string[] = [];
  private segmentWritten: string[] = [];
  private segmentToolCalls: TrackedToolCall[] = [];

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

  getSegment(): SessionSegment {
    return {
      filesRead: [...this.segmentRead],
      filesWritten: [...this.segmentWritten],
      toolCalls: [...this.segmentToolCalls],
      startTurn: this.lastSnapshotTurn + 1,
      endTurn: this.turnCount,
    };
  }

  resetSegment(): void {
    this.lastSnapshotTurn = this.turnCount;
    this.segmentRead = [];
    this.segmentWritten = [];
    this.segmentToolCalls = [];
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
      snapshots: [...this.snapshots],
    };
  }

  private trackToolEnd(event: AgentEvent, abDirectory: string): void {
    const info = extractToolInfo(event);
    if (!info) return;

    const timestamp = new Date().toISOString();
    const path = info.path ? relPath(abDirectory, info.path) : undefined;
    const entry: TrackedToolCall = { name: info.name, path, timestamp };
    this.toolCalls.push(entry);
    this.segmentToolCalls.push(entry);

    if (path && READ_TOOLS.has(info.name)) {
      this.pushUnique(this.filesRead, path);
      this.pushUnique(this.segmentRead, path);
    }
    if (path && WRITE_TOOLS.has(info.name)) {
      this.pushUnique(this.filesWritten, path);
      this.pushUnique(this.segmentWritten, path);
    }
  }

  private pushUnique(list: string[], value: string): void {
    if (!list.includes(value)) list.push(value);
  }
}
