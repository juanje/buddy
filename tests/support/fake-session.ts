// tests/support/fake-session.ts — Fake Pi session for BDD tests.
// Implements the PiSessionLike surface and emits events with the SAME shapes
// as the real SDK (verified against pi-agent-core types.d.ts and
// pi-coding-agent agent-session.d.ts in the Phase 0 spike):
//
//   { type: "agent_start" }
//   { type: "message_start", message }
//   { type: "message_update", message, assistantMessageEvent: { type: "text_delta", contentIndex, delta, partial } }
//   { type: "message_end", message }
//   { type: "agent_end", messages, willRetry }
//
// Streaming is driven manually by the step definitions (emitStart, emitDelta,
// emitEnd) so scenarios control exactly how much text has arrived.

import type { AgentEvent } from "../../shared/api";
import type { PiSessionLike } from "../../backends/worker-core";

export class FakeSession implements PiSessionLike {
  promptCalls: string[] = [];
  abortCalls = 0;
  disposed = false;

  private listeners = new Set<(event: AgentEvent) => void>();
  private streaming = false;
  private currentText = "";

  get isStreaming(): boolean {
    return this.streaming;
  }

  subscribe(listener: (event: AgentEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async prompt(text: string, _options?: unknown): Promise<void> {
    this.promptCalls.push(text);
    this.beginStreaming();
  }

  async abort(): Promise<void> {
    this.abortCalls++;
    if (this.streaming) {
      // Real behavior: aborting mid-stream ends the run; partial content
      // already emitted stays in the transcript.
      this.endStreaming();
    }
  }

  dispose(): void {
    this.disposed = true;
  }

  // --- Test drivers -------------------------------------------------------

  beginStreaming(): void {
    this.streaming = true;
    this.currentText = "";
    this.emit({ type: "agent_start" });
  }

  emitAssistantMessageStart(): void {
    this.emit({
      type: "message_start",
      message: { role: "assistant", content: [] },
    });
  }

  emitTextDelta(delta: string): void {
    this.currentText += delta;
    this.emit({
      type: "message_update",
      message: { role: "assistant" },
      assistantMessageEvent: {
        type: "text_delta",
        contentIndex: 0,
        delta,
        partial: { role: "assistant" },
      },
    });
  }

  emitAssistantMessageEnd(): void {
    this.emit({
      type: "message_end",
      message: { role: "assistant", content: [{ type: "text", text: this.currentText }] },
    });
  }

  endStreaming(): void {
    this.streaming = false;
    this.emit({ type: "agent_end", messages: [], willRetry: false });
  }

  emitToolExecutionEnd(toolName: string, path?: string): void {
    this.emit({
      type: "tool_execution_end",
      toolCall: { name: toolName, args: path ? { path } : {} },
    });
  }

  emitCompactionStart(): void {
    this.emit({ type: "compaction_start" });
  }

  /** Convenience: stream a full assistant response in one go. */
  streamResponse(chunks: string[]): void {
    if (!this.streaming) this.beginStreaming();
    this.emitAssistantMessageStart();
    for (const chunk of chunks) this.emitTextDelta(chunk);
    this.emitAssistantMessageEnd();
    this.endStreaming();
  }

  private emit(event: AgentEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
