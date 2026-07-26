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

import { AGENT_TOOLS, EXCLUDED_TOOLS } from "../shared/defaults";
import type { AgentEvent } from "../shared/api";
import {
  advanceCounters,
  appendConsolidationLogEntry,
  cascadeDepths,
  loadConsolidationState,
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
import { assembleMaintenancePrompt } from "./prompt";
import { appendDailyLog, updateLogsIndexEntry } from "./reflect";
import { defaultConfigDir } from "./allowed-paths";
import { globalConfigDir } from "./global-config";
import { recordUsageToFile, sumUsageFromEvents } from "./usage-tracker";
import { buildConsolidationTools, consolidationToolNames } from "./consolidation-tools";
import { buildSkillTools, skillToolNames } from "./skill-tools";

export interface MaintenanceSessionLike {
  prompt(text: string): Promise<void>;
  dispose(): void;
}

export interface CreateMaintenanceSessionFn {
  (options: {
    rootDir: string;
    modelRuntime: ModelRuntime;
  }): Promise<MaintenanceSessionLike>;
}

function readConsolidationSkill(rootDir: string): string {
  const globalPath = join(globalConfigDir(), "prompts", "consolidation.md");
  const legacyPath = join(rootDir, ".buddy", "prompts", "consolidation.md");
  try {
    return readFileSync(globalPath, "utf8");
  } catch {
    try {
      return readFileSync(legacyPath, "utf8");
    } catch {
      return "# Consolidation\n\nRun the consolidation procedure for the requested depth.";
    }
  }
}

export function buildConsolidationPrompt(
  rootDir: string,
  depth: number,
  now: Date = new Date(),
): string {
  const skill = readConsolidationSkill(rootDir);
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

export async function createMaintenanceSession(options: {
  rootDir: string;
  modelRuntime: ModelRuntime;
}): Promise<MaintenanceSessionLike> {
  const { rootDir, modelRuntime } = options;
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
  const allCustomTools = [...skillTools, ...consolTools];

  const { session } = await createAgentSession({
    cwd: rootDir,
    resourceLoader,
    sessionManager: SessionManager.create(rootDir),
    excludeTools: [...EXCLUDED_TOOLS],
    tools: [...AGENT_TOOLS, ...skillToolNames(skillTools), ...consolidationToolNames(consolTools)],
    customTools: allCustomTools,
    modelRuntime,
  });

  const events: AgentEvent[] = [];
  const unsub = session.subscribe((event) => events.push(event));

  return {
    async prompt(text) {
      await session.prompt(text);
      const usage = sumUsageFromEvents(events);
      if (usage.cost > 0 || usage.tokens > 0) {
        recordUsageToFile(defaultConfigDir(), usage);
      }
      events.length = 0;
    },
    dispose: () => {
      unsub();
      session.dispose();
    },
  };
}

export interface RunConsolidationOptions {
  rootDir: string;
  targetDepth: 1 | 2 | 3;
  modelRuntime: ModelRuntime;
  state?: ConsolidationState;
  createSession?: CreateMaintenanceSessionFn;
  now?: Date;
}

export interface RunConsolidationResult {
  ran: boolean;
  completedDepths: number[];
  state: ConsolidationState;
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

  if (!acquireLock(rootDir)) {
    return { ran: false, completedDepths, state };
  }

  let maintenanceSession: MaintenanceSessionLike | undefined;

  try {
    maintenanceSession = await createSession({ rootDir, modelRuntime });
    const date = toIsoDay(now);

    for (const depth of cascadeDepths(targetDepth)) {
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
        logEvent(rootDir, { event: "consolidation_complete", depth });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        appendConsolidationLogEntry(rootDir, {
          timestamp: now.toISOString(),
          depth,
          duration_ms: Date.now() - start,
          status: "fail",
          error: message,
        });
        logEvent(rootDir, { event: "consolidation_error", depth, error: message });
        throw error;
      }
    }

    saveConsolidationState(rootDir, state);

    if (completedDepths.length > 0) {
      const depthLabel = completedDepths.map((d) => `depth-${d}`).join(", ");
      appendDailyLog(rootDir, {
        date,
        sessionHeader: `${now.toISOString().slice(11, 16)} consolidation`,
        sections: `Maintenance cycle completed: ${depthLabel}.`,
        status: "maintenance",
      }, now);
      updateLogsIndexEntry(rootDir, date, "maintenance");
      await commitAll(rootDir, commitMessageForDepth(targetDepth, now));
    }

    return { ran: completedDepths.length > 0, completedDepths, state };
  } finally {
    maintenanceSession?.dispose();
    releaseLock(rootDir);
  }
}
