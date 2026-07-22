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

const CONSOLIDATION_SKILL = join("agent_brain", "skills", "consolidation.md");

export interface MaintenanceSessionLike {
  prompt(text: string): Promise<void>;
  dispose(): void;
}

export interface CreateMaintenanceSessionFn {
  (options: {
    abDirectory: string;
    modelRuntime: ModelRuntime;
  }): Promise<MaintenanceSessionLike>;
}

function readConsolidationSkill(abDirectory: string): string {
  try {
    return readFileSync(join(abDirectory, CONSOLIDATION_SKILL), "utf8");
  } catch {
    return "# Consolidation\n\nRun the consolidation procedure for the requested depth.";
  }
}

export function buildConsolidationPrompt(abDirectory: string, depth: number): string {
  const skill = readConsolidationSkill(abDirectory);
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
  abDirectory: string;
  modelRuntime: ModelRuntime;
}): Promise<MaintenanceSessionLike> {
  const { abDirectory, modelRuntime } = options;
  const { prompt: systemPrompt } = assembleSystemPrompt(abDirectory);
  const resourceLoader = new DefaultResourceLoader({
    cwd: abDirectory,
    agentDir: getAgentDir(),
    systemPromptOverride: () => systemPrompt,
  });
  await resourceLoader.reload();

  const { session } = await createAgentSession({
    cwd: abDirectory,
    resourceLoader,
    sessionManager: SessionManager.create(abDirectory),
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
  abDirectory: string;
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
    abDirectory,
    targetDepth,
    modelRuntime,
    createSession = createMaintenanceSession,
    now = new Date(),
  } = options;
  const state = options.state ?? loadConsolidationState(abDirectory);
  const completedDepths: number[] = [];

  if (!acquireLock(abDirectory)) {
    return { ran: false, completedDepths, state };
  }

  let maintenanceSession: MaintenanceSessionLike | undefined;

  try {
    maintenanceSession = await createSession({ abDirectory, modelRuntime });

    for (const depth of cascadeDepths(targetDepth)) {
      const start = Date.now();
      try {
        logEvent(abDirectory, { event: "consolidation_start", depth });
        await maintenanceSession.prompt(buildConsolidationPrompt(abDirectory, depth));
        await commitAll(abDirectory, commitMessageForDepth(depth, now));
        appendConsolidationLogEntry(abDirectory, {
          timestamp: now.toISOString(),
          depth,
          duration_ms: Date.now() - start,
          status: "success",
        });
        advanceCounters(state, depth, now);
        completedDepths.push(depth);
        logEvent(abDirectory, { event: "consolidation_complete", depth });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        appendConsolidationLogEntry(abDirectory, {
          timestamp: now.toISOString(),
          depth,
          duration_ms: Date.now() - start,
          status: "fail",
          error: message,
        });
        logEvent(abDirectory, { event: "consolidation_error", depth, error: message });
        throw error;
      }
    }

    saveConsolidationState(abDirectory, state);
    return { ran: completedDepths.length > 0, completedDepths, state };
  } finally {
    maintenanceSession?.dispose();
    releaseLock(abDirectory);
  }
}
