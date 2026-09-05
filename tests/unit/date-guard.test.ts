// tests/unit/date-guard.test.ts — FR-SESSION-06 mid-session date guard.

import { describe, expect, it } from "vitest";

import {
  createDateGuardExtension,
  createDateGuardHandler,
  maybeRefreshSystemPromptDate,
  replaceSystemPromptDateSection,
} from "../../backends/date-guard";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const SAMPLE_PROMPT = [
  "# Rules",
  "",
  "---",
  "",
  "# Current date and time",
  "",
  "Friday, 28 August 2026, 10:00",
].join("\n");

describe("replaceSystemPromptDateSection", () => {
  it("replaces the current date and time line", () => {
    const now = new Date(2026, 7, 29, 9, 15);
    const updated = replaceSystemPromptDateSection(SAMPLE_PROMPT, now);
    expect(updated).toContain("Saturday, 29 August 2026, 09:15");
    expect(updated).not.toContain("Friday, 28 August 2026");
  });
});

describe("maybeRefreshSystemPromptDate", () => {
  it("returns undefined on the same calendar day", () => {
    const now = new Date(2026, 7, 28, 23, 59);
    expect(maybeRefreshSystemPromptDate(SAMPLE_PROMPT, "2026-08-28", now)).toBeUndefined();
  });

  it("returns an updated prompt when the day rolls over", () => {
    const now = new Date(2026, 7, 29, 0, 5);
    const result = maybeRefreshSystemPromptDate(SAMPLE_PROMPT, "2026-08-28", now);
    expect(result?.isoDay).toBe("2026-08-29");
    expect(result?.systemPrompt).toContain("Saturday, 29 August 2026");
  });
});

describe("createDateGuardHandler", () => {
  it("leaves the prompt unchanged on same-day turns", async () => {
    const sessionStart = new Date(2026, 7, 28, 10, 0);
    const handler = createDateGuardHandler(sessionStart, () => new Date(2026, 7, 28, 18, 0));
    const result = await handler({ systemPrompt: SAMPLE_PROMPT });
    expect(result).toBeUndefined();
  });

  it("refreshes the prompt after a day rollover", async () => {
    const sessionStart = new Date(2026, 7, 28, 10, 0);
    let current = new Date(2026, 7, 29, 9, 0);
    const handler = createDateGuardHandler(sessionStart, () => current);
    const first = await handler({ systemPrompt: SAMPLE_PROMPT });
    expect(first?.systemPrompt).toContain("Saturday, 29 August 2026");

    current = new Date(2026, 7, 29, 15, 0);
    const second = await handler({ systemPrompt: first!.systemPrompt });
    expect(second).toBeUndefined();
  });

  it("handles multiple day rollovers across a long session", async () => {
    const sessionStart = new Date(2026, 7, 28, 10, 0);
    let current = new Date(2026, 7, 29, 9, 0);
    const handler = createDateGuardHandler(sessionStart, () => current);
    const dayTwo = await handler({ systemPrompt: SAMPLE_PROMPT });
    expect(dayTwo?.systemPrompt).toContain("Saturday, 29 August 2026");

    current = new Date(2026, 7, 30, 8, 0);
    const dayThree = await handler({ systemPrompt: dayTwo!.systemPrompt });
    expect(dayThree?.systemPrompt).toContain("Sunday, 30 August 2026");
  });
});

describe("createDateGuardExtension", () => {
  it("registers a before_agent_start hook", () => {
    const handlers: Record<string, Array<(...args: unknown[]) => unknown>> = {};
    const pi = {
      on: (event: string, handler: (...args: unknown[]) => unknown) => {
        handlers[event] = handlers[event] ?? [];
        handlers[event].push(handler);
      },
    } as ExtensionAPI;

    createDateGuardExtension(new Date(2026, 7, 28, 10, 0))(pi);
    expect(handlers.before_agent_start).toHaveLength(1);
  });
});
