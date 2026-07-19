// tests/unit/warm-handoff.test.ts — FR-SETUP-09 warm handoff prompt and filtering.

import { describe, expect, it, vi } from "vitest";

import { buildWarmHandoffPrompt, runWarmHandoff } from "../../backends/warm-handoff";
import { FakeSession } from "../support/fake-session";

describe("warm handoff", () => {
  it("builds a system-framed prompt with user data", () => {
    const prompt = buildWarmHandoffPrompt({
      name: "María",
      about: "Likes reading",
    });
    expect(prompt).toContain('Their name is "María"');
    expect(prompt).toContain('They said about themselves: "Likes reading"');
    expect(prompt).toMatch(/^\[System:/);
  });

  it("forwards assistant events but not the hidden user prompt", async () => {
    const session = new FakeSession();
    const onAgentEvent = vi.fn();
    const frontend = { onAgentEvent, onWorkerError: vi.fn(), onPermissionRequest: vi.fn() };

    const run = runWarmHandoff(session, frontend, { name: "Alex" });
    session.streamResponse(["Hello Alex!"]);
    await run;

    expect(session.promptCalls).toHaveLength(1);
    expect(session.promptCalls[0]).toContain("Alex");
    const types = onAgentEvent.mock.calls.map(([event]) => event.type);
    expect(types).toContain("agent_start");
    expect(types).toContain("message_update");
    const userStarts = onAgentEvent.mock.calls.filter(
      ([event]) =>
        event.type === "message_start" &&
        (event.message as { role?: string } | undefined)?.role === "user",
    );
    expect(userStarts).toHaveLength(0);
  });
});
