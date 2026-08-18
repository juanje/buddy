// tests/unit/skill-usage-tracking.test.ts — FR-CONSOL-18.

import { describe, expect, it } from "vitest";

import { defaultConsolidationState } from "../../shared/consolidation-state";
import {
  formatSkillUsageBlock,
  recordSkillInvocation,
  resetPeriodCounters,
} from "../../backends/skill-usage-tracking";

describe("skill usage tracking", () => {
  it("records invocation counters", () => {
    const state = defaultConsolidationState();
    const updated = recordSkillInvocation(state, "process_conversation", new Date(2026, 7, 17, 10, 0));
    expect(updated.skillUsage?.process_conversation.lastInvoked).toBe("2026-08-17T10:00");
    expect(updated.skillUsage?.process_conversation.invokedThisPeriod).toBe(1);
    expect(updated.skillUsage?.process_conversation.totalInvocations).toBe(1);
  });

  it("resets period counters", () => {
    const state = defaultConsolidationState();
    state.skillUsage = {
      triage_inbox: {
        lastInvoked: "2026-08-10T10:00",
        invokedThisPeriod: 3,
        totalInvocations: 8,
      },
    };
    resetPeriodCounters(state);
    expect(state.skillUsage.triage_inbox.invokedThisPeriod).toBe(0);
    expect(state.skillUsage.triage_inbox.totalInvocations).toBe(8);
  });

  it("formats skill usage block", () => {
    const block = formatSkillUsageBlock({
      review_draft: {
        lastInvoked: "2026-08-15T10:00",
        invokedThisPeriod: 2,
        totalInvocations: 5,
      },
    });
    expect(block).toContain("review_draft");
    expect(block).toContain("invoked 2x");
  });
});
