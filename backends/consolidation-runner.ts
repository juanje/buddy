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
import {
  advanceCounters,
  appendConsolidationLogEntry,
  cascadeDepths,
  loadConsolidationState,
  saveConsolidationState,
  type ConsolidationState,
} from "../shared/consolidation-state";
import { isoWeekLabel, toIsoDay } from "../shared/dates";
import { logEvent } from "./app-logger";
import { commitAll } from "./git";
import { acquireLock, releaseLock } from "./maintenance";
import { assembleSystemPrompt } from "./prompt";
import { appendDailyLog, updateLogsIndexEntry } from "./reflect";

const CONSOLIDATION_SKILL = join(".buddy", "prompts", "consolidation.md");

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
  try {
    return readFileSync(join(rootDir, CONSOLIDATION_SKILL), "utf8");
  } catch {
    return "# Consolidation\n\nRun the consolidation procedure for the requested depth.";
  }
}

export function buildConsolidationPrompt(rootDir: string, depth: number): string {
  const skill = readConsolidationSkill(rootDir);
  return (
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
  const { prompt: systemPrompt } = assembleSystemPrompt(rootDir);
  const resourceLoader = new DefaultResourceLoader({
    cwd: rootDir,
    agentDir: getAgentDir(),
    systemPromptOverride: () => systemPrompt,
  });
  await resourceLoader.reload();

  const { session } = await createAgentSession({
    cwd: rootDir,
    resourceLoader,
    sessionManager: SessionManager.create(rootDir),
    excludeTools: [...EXCLUDED_TOOLS],
    tools: [...AGENT_TOOLS],
    modelRuntime,
  });

  return {
    prompt: (text) => session.prompt(text),
    dispose: () => session.dispose(),
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

    for (const depth of cascadeDepths(targetDepth)) {
      const start = Date.now();
      try {
        logEvent(rootDir, { event: "consolidation_start", depth });
        await maintenanceSession.prompt(buildConsolidationPrompt(rootDir, depth));
        await commitAll(rootDir, commitMessageForDepth(depth, now));
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
      const maintenanceDate = toIsoDay(now);
      appendDailyLog(rootDir, {
        date: maintenanceDate,
        sessionHeader: `${now.toISOString().slice(11, 16)} consolidation`,
        sections: `Maintenance cycle completed: ${depthLabel}.`,
        status: "maintenance",
      }, now);
      updateLogsIndexEntry(rootDir, maintenanceDate, "maintenance");
      await commitAll(rootDir, `maintenance: log entry for ${depthLabel}`);
    }

    return { ran: completedDepths.length > 0, completedDepths, state };
  } finally {
    maintenanceSession?.dispose();
    releaseLock(rootDir);
  }
}
