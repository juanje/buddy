// backends/consolidation-content.ts — New-content detection for consolidation triggers (FR-CONSOL-01).

import { hasUncommittedChanges, gitClient } from "./git";
import type { ConsolidationState } from "../shared/consolidation-state";

/** Latest consolidation timestamp across all depths, or null if never run. */
export function latestConsolidationTimestamp(state: ConsolidationState): string | null {
  const stamps = [state.lastDepth1, state.lastDepth2, state.lastDepth3].filter(Boolean) as string[];
  if (stamps.length === 0) return null;
  return stamps.sort().at(-1) ?? null;
}

/**
 * True when git shows uncommitted changes or commits since the last consolidation run.
 * Used by the heartbeat before triggering consolidation (FR-CONSOL-01).
 */
export async function hasNewContentSinceConsolidation(
  rootDir: string,
  state: ConsolidationState,
): Promise<boolean> {
  try {
    if (await hasUncommittedChanges(rootDir)) return true;
  } catch {
    return state.sessionsSinceLastDepth1 > 0 || latestConsolidationTimestamp(state) === null;
  }

  const since = latestConsolidationTimestamp(state);
  if (!since) return true;

  try {
    const git = gitClient(rootDir);
    const log = await git.log({ "--since": since, maxCount: 1 });
    return log.total > 0;
  } catch {
    return state.sessionsSinceLastDepth1 > 0;
  }
}
