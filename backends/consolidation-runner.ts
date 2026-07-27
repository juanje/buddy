// backends/consolidation-runner.ts — Autonomous consolidation sessions (FR-CONSOL-03/04/06).

import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  SessionManager,
  type ModelRuntime,
} from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  AGENT_TOOLS,
  CONSOLIDATION_RETRY_CEILING,
  EXCLUDED_TOOLS,
} from "../shared/defaults";
import type { AgentEvent } from "../shared/api";
import {
  advanceCounters,
  appendConsolidationLogEntry,
  cascadeDepths,
  depthBlockReason,
  loadConsolidationState,
  recordDepthFailure,
  saveConsolidationState,
  type ConsolidationState,
} from "../shared/consolidation-state";
import { isoWeekLabel, toIsoDay } from "../shared/dates";
import {
  computeBrainHealthReport,
  computeHebbianReport,
  extractRipeObservations,
  findUpcomingReminders,
  formatBrainHealthReportBlock,
  formatHebbianReportBlock,
  formatRipeObservationsBlock,
  formatUpcomingRemindersBlock,
  rotateLogs,
  updateLogsIndexFromDaySummary,
} from "./consolidation-mechanics";
import { logEvent } from "./app-logger";
import { commitAll } from "./git";
import { acquireLock, releaseLock } from "./maintenance";
import { createPermissionGate, type PermissionRequest } from "./permissions";
import { assembleMaintenancePrompt } from "./prompt";
import { appendDailyLog, updateLogsIndexEntry } from "./reflect";
import { defaultConfigDir } from "./allowed-paths";
import { globalConfigDir } from "./global-config";
import { recordSessionUsage } from "./usage-tracker";
import { buildConsolidationTools, consolidationToolNames } from "./consolidation-tools";
import { buildSkillTools, skillToolNames } from "./skill-tools";

export interface MaintenanceSessionLike {
  prompt(text: string): Promise<void>;
  dispose(): void;
  /** Paths refused during the run, for the journal (FR-CONSOL-10). */
  refusedPaths?(): string[];
  /** True when the run wrote to SOUL.md (FR-CONSOL-11). */
  changedIdentity?(): boolean;
}

/**
 * Permission policy for an unattended session (FR-CONSOL-10).
 *
 * The gate is the same one the chat session uses; only the answer to "ask"
 * differs, because there is nobody to ask. `outside` is refused — nothing
 * consolidation legitimately touches lives beyond the workspace. `identity-write`
 * is allowed, because promoting a universal trait into SOUL.md is what
 * consolidation.md tells the agent to do.
 */
/**
 * Just the part of a Pi session the gate touches. Derived from the SDK's own
 * return type rather than hand-written, so a signature change upstream fails the
 * build here instead of silently drifting. (The hook's context type lives in a
 * nested package and is not re-exported, so it cannot be imported by name.)
 */
export type GateInstallable = Pick<
  Awaited<ReturnType<typeof createAgentSession>>["session"],
  "agent"
>;

/**
 * Install the zone-model gate on a maintenance session (FR-CONSOL-10).
 *
 * Extracted from `createMaintenanceSession` so the *wiring* is testable, not
 * just the policy. The original defect was not a wrong policy — it was that no
 * hook was installed at all, and a test of the policy alone would not have
 * caught it.
 */
export function installMaintenanceGate(
  session: GateInstallable,
  rootDir: string,
): ReturnType<typeof createMaintenancePermissionPolicy> {
  const policy = createMaintenancePermissionPolicy();
  const gate = createPermissionGate(rootDir, policy.askUser);
  const originalBeforeToolCall = session.agent.beforeToolCall;
  session.agent.beforeToolCall = async (ctx, signal) => {
    const prior = await originalBeforeToolCall?.(ctx, signal);
    if (prior?.block) return prior;
    const blocked = await gate.check(ctx.toolCall.name, ctx.args);
    return blocked ?? prior;
  };
  return policy;
}

export function createMaintenancePermissionPolicy(): {
  askUser: (request: Omit<PermissionRequest, "id">) => Promise<boolean>;
  refusedPaths: () => string[];
  changedIdentity: () => boolean;
} {
  const refused: string[] = [];
  let identityChanged = false;

  return {
    async askUser(request) {
      if (request.kind === "identity-write") {
        identityChanged = true;
        return true;
      }
      refused.push(request.path);
      return false;
    },
    refusedPaths: () => [...refused],
    changedIdentity: () => identityChanged,
  };
}

export interface CreateMaintenanceSessionFn {
  (options: {
    rootDir: string;
    modelRuntime: ModelRuntime;
  }): Promise<MaintenanceSessionLike>;
}

function readConsolidationSkill(): string {
  const globalPath = join(globalConfigDir(), "prompts", "consolidation.md");
  try {
    return readFileSync(globalPath, "utf8");
  } catch {
    return "# Consolidation\n\nRun the consolidation procedure for the requested depth.";
  }
}

export function buildConsolidationPrompt(
  rootDir: string,
  depth: number,
  now: Date = new Date(),
): string {
  const skill = readConsolidationSkill();
  const date = toIsoDay(now);
  const hebbianBlock = formatHebbianReportBlock(computeHebbianReport(rootDir, now));
  const remindersBlock = formatUpcomingRemindersBlock(findUpcomingReminders(rootDir, date));
  const healthBlock = formatBrainHealthReportBlock(computeBrainHealthReport(rootDir));
  const ripeBlock = formatRipeObservationsBlock(extractRipeObservations(rootDir));

  return (
    `Date: ${date}\n\n` +
    `${remindersBlock}\n\n` +
    `${hebbianBlock}\n\n` +
    (healthBlock ? `${healthBlock}\n\n` : "") +
    `${ripeBlock}\n\n` +
    `Run consolidation at depth ${depth}.\n\n` +
    `Follow the procedure below. Do not run git commands — the runner commits after you finish.\n\n` +
    skill
  );
}

function commitMessageForDepth(depth: number, now: Date): string {
  const day = toIsoDay(now);
  switch (depth) {
    case 1:
      return `daily: ${day}`;
    case 2:
      return `weekly: ${isoWeekLabel(now)}`;
    case 3:
      return `monthly: ${day}`;
    default:
      return `consolidation: depth ${depth}`;
  }
}

/** What `createMaintenanceSession` needs from a Pi session. */
export type MaintenanceAgentSession = Pick<
  Awaited<ReturnType<typeof createAgentSession>>["session"],
  "agent" | "subscribe" | "prompt" | "dispose"
>;

async function openRealMaintenanceSession(config: {
  rootDir: string;
  modelRuntime: ModelRuntime;
}): Promise<MaintenanceAgentSession> {
  const { rootDir, modelRuntime } = config;
  const systemPrompt = assembleMaintenancePrompt(rootDir);
  const resourceLoader = new DefaultResourceLoader({
    cwd: rootDir,
    agentDir: getAgentDir(),
    systemPromptOverride: () => systemPrompt,
  });
  await resourceLoader.reload();

  const promptsDir = join(globalConfigDir(), "prompts");
  const skillTools = buildSkillTools(promptsDir);
  const consolTools = buildConsolidationTools(rootDir);

  const { session } = await createAgentSession({
    cwd: rootDir,
    resourceLoader,
    sessionManager: SessionManager.create(rootDir),
    excludeTools: [...EXCLUDED_TOOLS],
    tools: [...AGENT_TOOLS, ...skillToolNames(skillTools), ...consolidationToolNames(consolTools)],
    customTools: [...skillTools, ...consolTools],
    modelRuntime,
  });
  return session;
}

export async function createMaintenanceSession(options: {
  rootDir: string;
  modelRuntime: ModelRuntime;
  /**
   * Injectable session opener. Exists so a test can observe that the permission
   * gate is actually installed on whatever session comes back — the original
   * defect was a missing call, and a missing call cannot be detected by
   * exercising the function that was never called (FR-CONSOL-10).
   */
  openSession?: (config: {
    rootDir: string;
    modelRuntime: ModelRuntime;
  }) => Promise<MaintenanceAgentSession>;
}): Promise<MaintenanceSessionLike> {
  const { rootDir, modelRuntime } = options;
  const openSession = options.openSession ?? openRealMaintenanceSession;
  const session = await openSession({ rootDir, modelRuntime });
  const policy = installMaintenanceGate(session, rootDir);

  const events: AgentEvent[] = [];
  const unsub = session.subscribe((event) => events.push(event));

  return {
    async prompt(text) {
      await session.prompt(text);
      recordSessionUsage(defaultConfigDir(), events);
      events.length = 0;
    },
    dispose: () => {
      unsub();
      session.dispose();
    },
    refusedPaths: policy.refusedPaths,
    changedIdentity: policy.changedIdentity,
  };
}

export interface RunConsolidationOptions {
  rootDir: string;
  targetDepth: 1 | 2 | 3;
  modelRuntime: ModelRuntime;
  state?: ConsolidationState;
  createSession?: CreateMaintenanceSessionFn;
  now?: Date;
  /**
   * Re-checked before each depth so a cascade already in flight stops when spend
   * crosses the background threshold (FR-COST-05). The heartbeat's pre-flight
   * check only covers the moment the cascade starts.
   */
  isBudgetNearLimit?: () => boolean;
}

export interface RunConsolidationResult {
  ran: boolean;
  completedDepths: number[];
  state: ConsolidationState;
  /** Set when the cascade stopped early rather than completing. */
  stoppedBy?: "budget" | "failure";
  /** Depths that reached the retry ceiling during this run (FR-CONSOL-09). */
  abandonedDepths: number[];
}

/**
 * Run consolidation at `targetDepth` with cascade ordering (FR-CONSOL-02).
 * Returns without running when the lock is held (FR-CONSOL-04).
 */
export async function runConsolidation(options: RunConsolidationOptions): Promise<RunConsolidationResult> {
  const {
    rootDir,
    targetDepth,
    modelRuntime,
    createSession = createMaintenanceSession,
    now = new Date(),
  } = options;
  const state = options.state ?? loadConsolidationState(rootDir);
  const completedDepths: number[] = [];
  const abandonedDepths: number[] = [];
  let stoppedBy: RunConsolidationResult["stoppedBy"];

  if (!acquireLock(rootDir)) {
    return { ran: false, completedDepths, state, abandonedDepths };
  }

  let maintenanceSession: MaintenanceSessionLike | undefined;

  try {
    maintenanceSession = await createSession({ rootDir, modelRuntime });
    const date = toIsoDay(now);

    for (const depth of cascadeDepths(targetDepth)) {
      // FR-COST-05: re-check before each billed call, not only before the cascade.
      if (options.isBudgetNearLimit?.()) {
        stoppedBy = "budget";
        appendConsolidationLogEntry(rootDir, {
          timestamp: now.toISOString(),
          depth,
          duration_ms: 0,
          status: "budget-stopped",
        });
        logEvent(rootDir, { event: "consolidation_budget_stopped", depth });
        break;
      }

      // A depth in backoff or past the ceiling is skipped without failing the
      // cascade — a broken depth 2 must not block depth 1 (FR-CONSOL-09).
      const blocked = depthBlockReason(state, depth, now);
      if (blocked) {
        appendConsolidationLogEntry(rootDir, {
          timestamp: now.toISOString(),
          depth,
          duration_ms: 0,
          status: "skipped",
          error: blocked,
        });
        logEvent(rootDir, { event: "consolidation_skipped", depth, reason: blocked });
        continue;
      }

      const start = Date.now();
      try {
        logEvent(rootDir, { event: "consolidation_start", depth });
        await maintenanceSession.prompt(buildConsolidationPrompt(rootDir, depth, now));
        if (depth === 1) {
          updateLogsIndexFromDaySummary(rootDir, date);
        }
        const { archived } = rotateLogs(rootDir, date);
        if (archived.length > 0) {
          appendDailyLog(
            rootDir,
            {
              date,
              sessionHeader: "log rotation",
              sections: `Archived ${archived.length} log files to logs/archive/: ${archived.join(", ")}.`,
              status: "maintenance",
            },
            now,
          );
        }
        appendConsolidationLogEntry(rootDir, {
          timestamp: now.toISOString(),
          depth,
          duration_ms: Date.now() - start,
          status: "success",
        });
        advanceCounters(state, depth, now);
        completedDepths.push(depth);
        // FR-CONSOL-08: persist immediately. Saving only after the whole
        // cascade meant a later failure discarded work already paid for.
        saveConsolidationState(rootDir, state);
        logEvent(rootDir, { event: "consolidation_complete", depth });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const failure = recordDepthFailure(state, depth, now);
        saveConsolidationState(rootDir, state);
        if (failure.count >= CONSOLIDATION_RETRY_CEILING) {
          abandonedDepths.push(depth);
        }
        appendConsolidationLogEntry(rootDir, {
          timestamp: now.toISOString(),
          depth,
          duration_ms: Date.now() - start,
          status: "fail",
          error: message,
        });
        logEvent(rootDir, {
          event: "consolidation_error",
          depth,
          error: message,
          failureCount: failure.count,
        });
        stoppedBy = "failure";
        break;
      }
    }

    saveConsolidationState(rootDir, state);

    if (completedDepths.length > 0) {
      const depthLabel = completedDepths.map((d) => `depth-${d}`).join(", ");
      const notes: string[] = [`Maintenance cycle completed: ${depthLabel}.`];

      // FR-CONSOL-11: SOUL.md is re-injected into every future session, so a
      // change to it must not be silent. Git holds the diff; this is how the
      // user learns to go look.
      if (maintenanceSession.changedIdentity?.()) {
        notes.push("Updated SOUL.md (character) during this cycle — review the commit if unexpected.");
      }

      const refused = maintenanceSession.refusedPaths?.() ?? [];
      if (refused.length > 0) {
        notes.push(
          `Refused ${refused.length} access attempt(s) outside the workspace: ${refused.join(", ")}.`,
        );
      }

      appendDailyLog(rootDir, {
        date,
        sessionHeader: `${now.toISOString().slice(11, 16)} consolidation`,
        sections: notes.join("\n\n"),
        status: "maintenance",
      }, now);
      updateLogsIndexEntry(rootDir, date, "maintenance");
      await commitAll(rootDir, commitMessageForDepth(targetDepth, now));
    }

    return {
      ran: completedDepths.length > 0,
      completedDepths,
      state,
      stoppedBy,
      abandonedDepths,
    };
  } finally {
    maintenanceSession?.dispose();
    releaseLock(rootDir);
  }
}
