// backends/skill-usage-tracking.ts — Skill invocation tracking for consolidation (FR-CONSOL-18).

import type { ConsolidationState, SkillUsageEntry } from "../shared/consolidation-state";
import { toLocalIsoStamp } from "../shared/dates";

export type { SkillUsageEntry };

export function recordSkillInvocation(
  state: ConsolidationState,
  skillName: string,
  now: Date = new Date(),
): ConsolidationState {
  const skillUsage = { ...(state.skillUsage ?? {}) };
  const existing = skillUsage[skillName];
  skillUsage[skillName] = {
    lastInvoked: toLocalIsoStamp(now),
    invokedThisPeriod: (existing?.invokedThisPeriod ?? 0) + 1,
    totalInvocations: (existing?.totalInvocations ?? 0) + 1,
  };
  return { ...state, skillUsage };
}

/** Reset per-period counters after each depth-2 run. */
export function resetPeriodCounters(state: ConsolidationState): void {
  if (!state.skillUsage) return;
  for (const name of Object.keys(state.skillUsage)) {
    const entry = state.skillUsage[name];
    if (!entry) continue;
    state.skillUsage[name] = { ...entry, invokedThisPeriod: 0 };
  }
}

export function formatSkillUsageBlock(
  skillUsage: Record<string, SkillUsageEntry> | undefined,
): string {
  const entries = Object.entries(skillUsage ?? {}).filter(([, entry]) => entry.invokedThisPeriod > 0);
  if (entries.length === 0) {
    return "Skill usage this week:\nNo skill tools invoked since the last depth-2 run.";
  }

  const lines = ["Skill usage this week:"];
  for (const [name, entry] of entries.sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(
      `- ${name}: invoked ${entry.invokedThisPeriod}x (last: ${entry.lastInvoked}, total: ${entry.totalInvocations})`,
    );
  }
  return lines.join("\n");
}
