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
}

function relPath(rootDir: string, absOrRel: string): string {
  if (absOrRel === rootDir) return absOrRel;
  const prefix = rootDir.endsWith(sep) ? rootDir : rootDir + sep;
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

  private activitySinceCheckpoint = false;
  private pendingArgs = new Map<string, { name: string; path?: string }>();

  constructor(sessionId: string, startTime: Date = new Date()) {
    this.sessionId = sessionId;
    this.startTime = startTime;
  }

  recordEvent(event: AgentEvent, rootDir: string): {
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
      this.trackToolEnd(event, rootDir);
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
    };
  }

  private trackToolEnd(event: AgentEvent, rootDir: string): void {
    const toolCallId = event.toolCallId as string | undefined;
    const endInfo = extractToolInfo(event);
    const startInfo = toolCallId ? this.pendingArgs.get(toolCallId) : undefined;
    if (toolCallId) this.pendingArgs.delete(toolCallId);

    const name = endInfo?.name ?? startInfo?.name;
    if (!name) return;

    const path = startInfo?.path ?? endInfo?.path;
    const timestamp = new Date().toISOString();
    const relP = path ? relPath(rootDir, path) : undefined;
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
