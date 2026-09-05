// backends/date-guard.ts — FR-SESSION-06: refresh system prompt date on day rollover.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { formatPlainDate, formatPlainTime } from "./prompt";
import { toIsoDay } from "../shared/dates";

export const CURRENT_DATE_TIME_HEADING = "# Current date and time";

export interface BeforeAgentStartEvent {
  systemPrompt: string;
}

export type DateGuardHandler = (
  event: BeforeAgentStartEvent,
) => Promise<{ systemPrompt: string } | undefined>;

/** Replace the frozen date/time line in an assembled system prompt. */
export function replaceSystemPromptDateSection(prompt: string, now: Date): string {
  const replacement = `${CURRENT_DATE_TIME_HEADING}\n\n${formatPlainDate(now)}, ${formatPlainTime(now)}`;
  const pattern = new RegExp(`${CURRENT_DATE_TIME_HEADING}\\n\\n[^\\n]+`);
  if (!pattern.test(prompt)) return prompt;
  return prompt.replace(pattern, replacement);
}

/**
 * When the calendar day has advanced since the last injection, return an updated
 * system prompt. Same-day turns return undefined (zero token cost).
 */
export function maybeRefreshSystemPromptDate(
  systemPrompt: string,
  lastInjectedIsoDay: string,
  now: Date,
): { systemPrompt: string; isoDay: string } | undefined {
  const today = toIsoDay(now);
  if (today === lastInjectedIsoDay) return undefined;
  return {
    systemPrompt: replaceSystemPromptDateSection(systemPrompt, now),
    isoDay: today,
  };
}

/** Testable handler backing the Pi extension hook. */
export function createDateGuardHandler(
  sessionStart: Date,
  clock: () => Date = () => new Date(),
): DateGuardHandler {
  let lastInjectedIsoDay = toIsoDay(sessionStart);

  return async (event) => {
    const refreshed = maybeRefreshSystemPromptDate(event.systemPrompt, lastInjectedIsoDay, clock());
    if (!refreshed) return undefined;
    lastInjectedIsoDay = refreshed.isoDay;
    return { systemPrompt: refreshed.systemPrompt };
  };
}

/** Pi SDK extension: refresh the system prompt date when a session spans midnight. */
export function createDateGuardExtension(
  sessionStart: Date,
  clock: () => Date = () => new Date(),
): (pi: ExtensionAPI) => void {
  const handler = createDateGuardHandler(sessionStart, clock);
  return (pi) => {
    pi.on("before_agent_start", async (event) => handler(event));
  };
}
