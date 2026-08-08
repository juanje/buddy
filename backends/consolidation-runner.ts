// backends/consolidation-runner.ts — Autonomous consolidation sessions (FR-CONSOL-03/04/06).

import {
  createAgentSession,
  DefaultResourceLoader,
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
import type { BrainHealthReport } from "./brain-health";
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
import { createHeadingGuard } from "./heading-guard";
import { createHebbianGuard } from "./hebbian-guard";
import { installEditRecoveryHook } from "./edit-recovery";
import { buddySessionsDir } from "./session-paths";
import {
  listChangedFilesSince,
  runPostConsolidationValidation,
} from "./post-consolidation-validation";
import { commitAll, gitClient } from "./git";
import { acquireLock, releaseLock } from "./maintenance";
import { createPermissionGate, type PermissionRequest } from "./permissions";
import { assembleMaintenancePrompt } from "./prompt";
import { appendDailyLog, updateLogsIndexEntry } from "./reflect";
import { buddyAgentDir, globalConfigDir } from "./global-config";
import { recordSessionUsage } from "./usage-tracker";
import { buildConsolidationTools, consolidationToolNames } from "./consolidation-tools";
import { buildSkillTools, skillToolNames } from "./skill-tools";
import { ensureUserMdSectionsOnDisk } from "./brain-migration";
import { fastModelForProvider } from "../shared/model-catalog";
import { readPiProvider } from "../shared/pi-settings";

export interface MaintenanceSessionLike {
  prompt(text: string): Promise<void>;
  dispose(): void;
  /** Paths refused during the run, for the journal (FR-CONSOL-10). */
  refusedPaths?(): string[];
  /** True when the run wrote to SOUL.md (FR-CONSOL-11). */
  changedIdentity?(): boolean;
}

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

/**
 * Install the hebbian guard on a maintenance session (FR-HEBB-08).
 *
 * Same capture-before / restore-after mechanism as the chat session, but wired
 * through beforeToolCall/afterToolCall hooks rather than the event stream.
 */
export function installMaintenanceHebbianGuard(
  session: GateInstallable,
  rootDir: string,
): void {
  const guard = createHebbianGuard(rootDir);

  const originalBefore = session.agent.beforeToolCall;
  session.agent.beforeToolCall = async (ctx, signal) => {
    const name = ctx.toolCall.name;
    if (name === "write" || name === "edit") {
      const path = (ctx.args as Record<string, unknown>)?.path;
      if (typeof path === "string") guard.capture(path);
    }
    return originalBefore?.(ctx, signal);
  };

  const originalAfter = (session.agent as unknown as Record<string, unknown>).afterToolCall as
    | ((ctx: unknown, signal?: AbortSignal) => Promise<unknown>) | undefined;
  (session.agent as unknown as Record<string, unknown>).afterToolCall = async (
    ctx: { toolCall: { name: string }; args: unknown; isError: boolean },
    signal?: AbortSignal,
  ) => {
    const name = ctx.toolCall.name;
    if ((name === "write" || name === "edit") && !ctx.isError) {
      const path = (ctx.args as Record<string, unknown>)?.path;
      if (typeof path === "string") guard.restore(path);
    }
    return originalAfter?.(ctx, signal);
  };
}

/**
 * Install the heading guard on a maintenance session (FR-GUARD-01).
 *
 * Same capture/check pattern as the hebbian guard, wired through the same
 * beforeToolCall/afterToolCall hooks. A write that removes a `## ` heading
 * from an `agent_brain/` or `logs/` file is reverted and logged.
 */
export function installMaintenanceHeadingGuard(
  session: GateInstallable,
  rootDir: string,
): void {
  const guard = createHeadingGuard(rootDir);

  const originalBefore = session.agent.beforeToolCall;
  session.agent.beforeToolCall = async (ctx, signal) => {
    const name = ctx.toolCall.name;
    if (name === "write" || name === "edit") {
      const path = (ctx.args as Record<string, unknown>)?.path;
      if (typeof path === "string") guard.capture(path);
    }
    return originalBefore?.(ctx, signal);
  };

  const originalAfter = (session.agent as unknown as Record<string, unknown>).afterToolCall as
    | ((ctx: unknown, signal?: AbortSignal) => Promise<unknown>) | undefined;
  (session.agent as unknown as Record<string, unknown>).afterToolCall = async (
    ctx: { toolCall: { name: string }; args: unknown; isError: boolean },
    signal?: AbortSignal,
  ) => {
    const name = ctx.toolCall.name;
    if ((name === "write" || name === "edit") && !ctx.isError) {
      const path = (ctx.args as Record<string, unknown>)?.path;
      if (typeof path === "string") {
        const result = guard.check(path);
        if (result.reverted) {
          logEvent(rootDir, {
            event: "heading_guard_revert",
            session: "maintenance",
            path,
            lostHeadings: result.lostHeadings,
          });
        }
      }
    }
    return originalAfter?.(ctx, signal);
  };
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
    depth: number;
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

type DepthModelOptions = {
  model?: Awaited<ReturnType<ModelRuntime["getModel"]>>;
  thinkingLevel?: "off";
};

/** Depth 1-2: fast tier with thinking off. Depth 3: configured model, default thinking. */
async function resolveDepthModel(
  depth: number,
  rootDir: string,
  modelRuntime: ModelRuntime,
): Promise<DepthModelOptions> {
  if (depth > 2) return {};
  const provider = readPiProvider(rootDir);
  const fastId = fastModelForProvider(provider);
  if (!fastId) return { thinkingLevel: "off" };
  let model = modelRuntime.getModel(provider, fastId);
  if (!model) {
    const available = await modelRuntime.getAvailable(provider);
    model = available.find((entry) => entry.id === fastId);
  }
  if (!model) return { thinkingLevel: "off" };
  return { model, thinkingLevel: "off" };
}

async function openRealMaintenanceSession(config: {
  rootDir: string;
  modelRuntime: ModelRuntime;
  depth: number;
}): Promise<MaintenanceAgentSession> {
  const { rootDir, modelRuntime, depth } = config;
  const depthModelOptions = await resolveDepthModel(depth, rootDir, modelRuntime);
  const systemPrompt = assembleMaintenancePrompt(rootDir);
  const resourceLoader = new DefaultResourceLoader({
    cwd: rootDir,
    agentDir: buddyAgentDir(), // NFR-SEC-19
    systemPromptOverride: () => systemPrompt,
  });
  await resourceLoader.reload();

  const promptsDir = join(globalConfigDir(), "prompts");
  const skillTools = buildSkillTools(promptsDir);
  const consolTools = buildConsolidationTools(rootDir);

  const { session } = await createAgentSession({
    cwd: rootDir,
    agentDir: buddyAgentDir(), // NFR-SEC-19: keeps SettingsManager off ~/.pi/agent
    resourceLoader,
    sessionManager: SessionManager.create(rootDir, buddySessionsDir(rootDir)),
    excludeTools: [...EXCLUDED_TOOLS],
    tools: [...AGENT_TOOLS, ...skillToolNames(skillTools), ...consolidationToolNames(consolTools)],
    customTools: [...skillTools, ...consolTools],
    modelRuntime,
    ...depthModelOptions,
  });
  return session;
}

/** A maintenance turn that produced nothing usable (FR-CONSOL-12). */
export class MaintenanceResponseError extends Error {}

/** A consolidation that left the brain structurally worse than it found it (FR-CONSOL-13). */
export class BrainDamagedError extends Error {}

/**
 * Refuse to call a consolidation successful when it broke frontmatter
 * (FR-CONSOL-13).
 *
 * The brain is written by the model, through `edit` and `write`, and until now
 * nothing checked the result. A depth-1 run on 2026-07-28 appended a second
 * `---` block to four concept files — inventing a `created` date earlier than
 * the file itself — and was recorded as a success. The linter existed but only
 * ran *before* the run, and only looked for frontmatter that was missing.
 *
 * Comparing before and after matters more than it looks: an instance carrying
 * inherited damage would otherwise fail every consolidation forever. Only files
 * this run broke count against it.
 */
export function assertNoNewBrainDamage(
  before: BrainHealthReport,
  after: BrainHealthReport,
): void {
  const known = new Set(before.malformedFrontmatter.map((entry) => entry.path));
  const introduced = after.malformedFrontmatter.filter((entry) => !known.has(entry.path));
  if (introduced.length === 0) return;

  throw new BrainDamagedError(
    `consolidation corrupted frontmatter in ${introduced.length} file(s): ` +
      introduced.map((entry) => `${entry.path} (${entry.problem})`).join("; "),
  );
}

interface ObservedMessage {
  role?: string;
  stopReason?: string;
  errorMessage?: string;
  content?: Array<{ type?: string; text?: string }>;
}

/**
 * Throw unless the exchange actually produced work (FR-CONSOL-12).
 *
 * `await session.prompt(...)` resolves whether the model consolidated the brain
 * or the provider returned 401. The SDK reports the second as an assistant
 * message carrying `stopReason: "error"`, not as a rejected promise — so the
 * only way to tell them apart is to look at what came back.
 *
 * Two rejections, and the second matters as much as the first: an errored turn,
 * and a turn that produced no content. A model that answers with nothing has
 * not consolidated anything either, and treating silence as success is what
 * advanced the maintenance clock over work that never happened.
 */
export function assertProductiveResponse(events: readonly AgentEvent[]): void {
  const assistantTurns = events
    .filter((event) => event.type === "message_end")
    .map((event) => event.message as ObservedMessage | undefined)
    .filter((message): message is ObservedMessage => message?.role === "assistant");

  const failed = assistantTurns.find((message) => message.stopReason === "error");
  if (failed) {
    throw new MaintenanceResponseError(
      failed.errorMessage ?? "the model reported an error and produced no output",
    );
  }

  if (assistantTurns.length === 0) {
    throw new MaintenanceResponseError("the model produced no response at all");
  }

  const producedSomething = assistantTurns.some((message) =>
    (message.content ?? []).some((block) =>
      block.type === "text" ? (block.text ?? "").trim() !== "" : true,
    ),
  );
  if (!producedSomething) {
    throw new MaintenanceResponseError("the model returned an empty response");
  }
}

export async function createMaintenanceSession(options: {
  rootDir: string;
  modelRuntime: ModelRuntime;
  depth: number;
  /**
   * Injectable session opener. Exists so a test can observe that the permission
   * gate is actually installed on whatever session comes back — the original
   * defect was a missing call, and a missing call cannot be detected by
   * exercising the function that was never called (FR-CONSOL-10).
   */
  openSession?: (config: {
    rootDir: string;
    modelRuntime: ModelRuntime;
    depth: number;
  }) => Promise<MaintenanceAgentSession>;
}): Promise<MaintenanceSessionLike> {
  const { rootDir, modelRuntime, depth } = options;
  const openSession = options.openSession ?? openRealMaintenanceSession;
  const session = await openSession({ rootDir, modelRuntime, depth });
  const policy = installMaintenanceGate(session, rootDir);
  installMaintenanceHebbianGuard(session, rootDir);
  installMaintenanceHeadingGuard(session, rootDir);
  installEditRecoveryHook(session);

  const events: AgentEvent[] = [];
  const unsub = session.subscribe((event) => events.push(event));

  return {
    async prompt(text) {
      await session.prompt(text);
      recordSessionUsage(globalConfigDir(), events);
      const observed = [...events];
      events.length = 0;
      // FR-CONSOL-12: `prompt` resolving is not evidence that anything
      // happened. Throwing here routes the failure into the runner's existing
      // catch, which records `status: "fail"`, counts it against the retry
      // ceiling and leaves the counters alone.
      assertProductiveResponse(observed);
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

  // Aggregate identity/refused across per-depth sessions for the final log.
  let anyChangedIdentity = false;
  const allRefusedPaths: string[] = [];
  let consolidationStartHead: string | null = null;

  try {
    const git = gitClient(rootDir);
    try {
      consolidationStartHead = (await git.revparse(["HEAD"])).trim();
    } catch {
      // Fresh repo with no commits — validation falls back to git status.
      consolidationStartHead = null;
    }
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

      // Each depth gets its own session so context from earlier depths does
      // not exhaust the model's effective window (#16 — session fatigue).
      let depthSession: MaintenanceSessionLike | undefined;
      const start = Date.now();
      try {
        depthSession = await createSession({ rootDir, modelRuntime, depth });
        ensureUserMdSectionsOnDisk(rootDir);
        logEvent(rootDir, { event: "consolidation_start", depth });
        const healthBefore = computeBrainHealthReport(rootDir);
        await depthSession.prompt(buildConsolidationPrompt(rootDir, depth, now));
        assertNoNewBrainDamage(healthBefore, computeBrainHealthReport(rootDir));
        if (depth === 1) {
          updateLogsIndexFromDaySummary(rootDir, date);
        }
        rotateLogs(rootDir, date);
        appendConsolidationLogEntry(rootDir, {
          timestamp: now.toISOString(),
          depth,
          duration_ms: Date.now() - start,
          status: "success",
        });
        advanceCounters(state, depth, now);
        completedDepths.push(depth);
        saveConsolidationState(rootDir, state);
        logEvent(rootDir, { event: "consolidation_complete", depth });

        if (depthSession.changedIdentity?.()) anyChangedIdentity = true;
        allRefusedPaths.push(...(depthSession.refusedPaths?.() ?? []));
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
      } finally {
        depthSession?.dispose();
      }
    }

    saveConsolidationState(rootDir, state);

    if (completedDepths.length > 0) {
      const depthLabel = completedDepths.map((d) => `depth-${d}`).join(", ");
      const notes: string[] = [];

      if (anyChangedIdentity) {
        notes.push("Updated SOUL.md (character) during this cycle — review the commit if unexpected.");
      }

      if (allRefusedPaths.length > 0) {
        notes.push(
          `Refused ${allRefusedPaths.length} access attempt(s) outside the workspace: ${allRefusedPaths.join(", ")}.`,
        );
      }

      if (notes.length > 0) {
        appendDailyLog(rootDir, {
          date,
          sessionHeader: `${now.toISOString().slice(11, 16)} consolidation`,
          sections: [`Maintenance cycle: ${depthLabel}.`, ...notes].join("\n\n"),
          status: "maintenance",
        }, now);
        updateLogsIndexEntry(rootDir, date, "maintenance");
      }
      if (consolidationStartHead) {
        const { newFiles, touchedFiles } = await listChangedFilesSince(
          consolidationStartHead,
          () => git.status(),
          (args) => git.diff(args),
        );
        runPostConsolidationValidation(rootDir, newFiles, touchedFiles);
      } else {
        const status = await git.status();
        const touchedFiles = [
          ...new Set([...status.modified, ...status.created, ...status.not_added]),
        ];
        const newFiles = [...new Set([...status.created, ...status.not_added])];
        runPostConsolidationValidation(rootDir, newFiles, touchedFiles);
      }
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
    releaseLock(rootDir);
  }
}
