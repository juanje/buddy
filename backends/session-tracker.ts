// backends/session-tracker.ts — In-memory session event accumulator (FR-REFLECT-01/03).

import type { AgentEvent } from "../shared/api";
import { READ_TOOLS, WRITE_TOOLS } from "../shared/defaults";

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
  const name = (event.toolName as string | undefined) ??
    (event.toolCall as { name?: string } | undefined)?.name;
  if (!name) return null;
  const args = (event.args as { path?: string } | undefined) ??
    (event.toolCall as { args?: { path?: string } } | undefined)?.args;
  const path = typeof args?.path === "string" ? args.path : undefined;
  return { name, path };
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
    this.segmentToolCalls.push(entry);

    if (relP && READ_TOOLS.has(name)) {
      this.pushUnique(this.filesRead, relP);
      this.pushUnique(this.segmentRead, relP);
    }
    if (relP && WRITE_TOOLS.has(name)) {
      this.pushUnique(this.filesWritten, relP);
      this.pushUnique(this.segmentWritten, relP);
    }
  }

  private pushUnique(list: string[], value: string): void {
    if (!list.includes(value)) list.push(value);
  }
}
