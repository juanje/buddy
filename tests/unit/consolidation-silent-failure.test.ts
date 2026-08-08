// tests/unit/consolidation-silent-failure.test.ts — FR-CONSOL-12.
//
// Reproduces a real incident, 2026-07-28. A depth-1 consolidation ran against a
// misconfigured endpoint. The provider answered 401, the SDK surfaced it as an
// assistant message with `stopReason: "error"` and empty content rather than by
// throwing, and `await session.prompt(...)` resolved normally. The runner's
// entire success path then executed:
//
//   .buddy/consolidation-log.json   {"duration_ms": 22, "status": "success"}
//   .buddy/consolidation-state.json lastDepth1 advanced, counters reset
//   logs/2026-07-28.md              "Maintenance cycle completed: depth-1."
//
// Twenty-two milliseconds. The two real depth-1 runs that day took 56s and 96s.
//
// The damage is not the failed run — runs fail. It is that the failure was
// indistinguishable from success in every artefact, so the maintenance clock
// advanced over work that never happened: whatever should have been promoted
// from observations.md is not queued, it is marked handled. H3 and H4b hardened
// this path, but only against *exceptions*. A failed response walked straight
// through.

import { describe, expect, it } from "vitest";

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  assertProductiveResponse,
  createMaintenanceSession,
  MaintenanceResponseError,
} from "../../backends/consolidation-runner";
import type { AgentEvent } from "../../shared/api";

/** An assistant turn that produced text. */
function completed(text = "Consolidated."): AgentEvent[] {
  return [
    { type: "message_start", message: { role: "assistant" } },
    {
      type: "message_end",
      message: { role: "assistant", stopReason: "stop", content: [{ type: "text", text }] },
    },
  ];
}

/** What the SDK actually emitted during the incident. */
function errored(message = "401: Invalid API key"): AgentEvent[] {
  return [
    { type: "message_start", message: { role: "assistant" } },
    {
      type: "message_end",
      message: { role: "assistant", stopReason: "error", errorMessage: message, content: [] },
    },
  ];
}

describe("assertProductiveResponse", () => {
  it("accepts a turn that produced text", () => {
    expect(() => assertProductiveResponse(completed())).not.toThrow();
  });

  it("rejects the incident: stopReason error with the provider message", () => {
    expect(() => assertProductiveResponse(errored())).toThrow(MaintenanceResponseError);
    expect(() => assertProductiveResponse(errored())).toThrow(/401/);
  });

  it("rejects a turn that emitted nothing at all", () => {
    // A session that returns without ever producing an assistant message did
    // not do the work either, however quietly it declined.
    expect(() => assertProductiveResponse([])).toThrow(MaintenanceResponseError);
  });

  it("rejects an assistant message with no content", () => {
    expect(() =>
      assertProductiveResponse([
        { type: "message_end", message: { role: "assistant", stopReason: "stop", content: [] } },
      ]),
    ).toThrow(MaintenanceResponseError);
  });

  it("rejects whitespace-only text, which is not consolidation", () => {
    expect(() => assertProductiveResponse(completed("   \n  "))).toThrow(MaintenanceResponseError);
  });

  it("ignores non-assistant messages when judging", () => {
    // The prompt itself is a user message; it must not count as a response.
    expect(() =>
      assertProductiveResponse([
        { type: "message_end", message: { role: "user", content: [{ type: "text", text: "go" }] } },
      ]),
    ).toThrow(MaintenanceResponseError);
  });

  it("accepts a turn whose work was tool calls rather than prose", () => {
    // Consolidation does much of its work through edit/write. A turn that
    // called tools and closed with a short acknowledgement is productive.
    expect(() =>
      assertProductiveResponse([
        { type: "message_end", message: { role: "assistant", stopReason: "tool_calls", content: [{ type: "tool_use", id: "1" }] } },
        { type: "message_end", message: { role: "assistant", stopReason: "stop", content: [{ type: "text", text: "Done." }] } },
      ]),
    ).not.toThrow();
  });

  it("rejects when any turn in the exchange errored, even if a later one did not", () => {
    // A mid-exchange provider failure means part of the procedure was skipped.
    expect(() =>
      assertProductiveResponse([...errored("500: upstream"), ...completed()]),
    ).toThrow(MaintenanceResponseError);
  });
});

// ---------------------------------------------------------------------------
// The wiring. Everything above proves the function; none of it proves anyone
// calls it — which is precisely how the original defect survived H3 and H4b.
// These drive the real maintenance session with an injected transport.
// ---------------------------------------------------------------------------

describe("the maintenance session refuses to report a failed turn as done", () => {
  /** A session that emits `events` when prompted, as the SDK would. */
  function sessionEmitting(events: AgentEvent[]) {
    const subscribers: Array<(event: AgentEvent) => void> = [];
    return {
      agent: {} as never,
      subscribe(fn: (event: AgentEvent) => void) {
        subscribers.push(fn);
        return () => subscribers.splice(subscribers.indexOf(fn), 1);
      },
      async prompt() {
        // Resolves normally — the whole point. A 401 is not a rejection.
        for (const event of events) for (const fn of subscribers) fn(event);
      },
      dispose() {},
    };
  }

  async function promptWith(events: AgentEvent[]): Promise<void> {
    const session = await createMaintenanceSession({
      rootDir: mkdtempSync(join(tmpdir(), "maintenance-")),
      modelRuntime: {} as never,
      depth: 1,
      openSession: async () => sessionEmitting(events) as never,
    });
    try {
      await session.prompt("consolidate");
    } finally {
      session.dispose();
    }
  }

  it("throws when the provider errored, though prompt() resolved", async () => {
    await expect(promptWith(errored())).rejects.toThrow(MaintenanceResponseError);
  });

  it("throws when nothing came back", async () => {
    await expect(promptWith([])).rejects.toThrow(MaintenanceResponseError);
  });

  it("stays quiet when the turn produced work", async () => {
    await expect(promptWith(completed())).resolves.toBeUndefined();
  });
});
