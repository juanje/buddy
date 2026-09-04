// backends/auth-error.ts — Auth error detection for chat and boot (FR-AUTH-02, FR-AUTH-02b).

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { AgentEvent, AuthErrorEvent, SetupProviderId } from "../shared/api";
import { APP_LOGS_DIR, isAuthError } from "../shared/defaults";
import { toIsoDay } from "../shared/dates";
import { fromPiProviderId, toPiProviderId } from "../shared/provider-mapping";

interface ObservedMessage {
  role?: string;
  stopReason?: string;
  errorMessage?: string;
}

/** Extract auth error message from Pi session events, if any. */
export function extractAuthErrorFromEvents(events: readonly AgentEvent[]): string | undefined {
  for (const event of events) {
    if (event.type !== "message_end") continue;
    const message = (event as { message?: ObservedMessage }).message;
    if (message?.role !== "assistant" || message.stopReason !== "error") continue;
    const errorMessage = message.errorMessage;
    if (errorMessage && isAuthError(errorMessage)) {
      return errorMessage;
    }
  }
  return undefined;
}

/** Alias used in specs and tests (FR-AUTH-02). */
export const detectAuthErrorInEvents = extractAuthErrorFromEvents;

/** Map an auth error message to a Buddy provider id when possible. */
export function providerFromAuthMessage(message: string): SetupProviderId {
  const forMatch = message.match(/\bfor\s+([\w-]+)/i);
  if (forMatch) {
    const mapped = fromPiProviderId(forMatch[1]);
    if (mapped) return mapped;
  }
  if (/anthropic/i.test(message)) return "anthropic";
  if (/openai|codex/i.test(message)) return "openai";
  if (/google/i.test(message)) return "google";
  return "anthropic";
}

export function toAuthErrorEvent(message: string): AuthErrorEvent {
  return { provider: providerFromAuthMessage(message), message };
}

type LogLine = { event?: string; message?: string; error?: string };

/** Scan today's app log for the most recent background auth failure. */
export function findRecentAuthErrorInLogs(rootDir: string, now = new Date()): AuthErrorEvent | undefined {
  const logPath = join(rootDir, APP_LOGS_DIR, `${toIsoDay(now)}.jsonl`);
  if (!existsSync(logPath)) return undefined;

  let latest: AuthErrorEvent | undefined;
  for (const line of readFileSync(logPath, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let parsed: LogLine;
    try {
      parsed = JSON.parse(line) as LogLine;
    } catch {
      continue;
    }
    const message = parsed.message ?? parsed.error;
    if (!message || !isAuthError(message)) continue;
    if (parsed.event !== "reflect_error" && parsed.event !== "consolidation_error") continue;
    latest = toAuthErrorEvent(message);
  }
  return latest;
}

/** Whether a boot-time auth card should be shown (FR-AUTH-02b). */
export function shouldEmitBootAuthCard(
  bootAuthError: AuthErrorEvent | undefined,
  reauthProviders: ReadonlySet<string> | undefined,
): bootAuthError is AuthErrorEvent {
  if (!bootAuthError) return false;
  return reauthProviders?.has(toPiProviderId(bootAuthError.provider)) ?? false;
}
