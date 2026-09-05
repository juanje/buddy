#!/usr/bin/env node
/**
 * Progress tracking CLI for the Outside-In (Spec → BDD → TDD) development cycle.
 *
 * Usage:
 *   npx tsx scripts/progress.ts current
 *   npx tsx scripts/progress.ts status
 *   npx tsx scripts/progress.ts show FR-xxx
 *   npx tsx scripts/progress.ts advance FR-xxx
 *   npx tsx scripts/progress.ts scenario pass FR-xxx "Scenario name"
 *   npx tsx scripts/progress.ts units FR-xxx "Scenario name" 3
 *   npx tsx scripts/progress.ts focus FR-xxx
 *   npx tsx scripts/progress.ts add FR-xxx "Title"
 *   npx tsx scripts/progress.ts done FR-xxx
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_PROGRESS_FILE = join(ROOT, "specs", "progress.json");
export const DEFAULT_SPEC_FILE = join(ROOT, "specs", "SPEC.md");

export const CYCLE_STEPS = [
  "spec_review",
  "bdd_red",
  "implementing",
  "bdd_green",
  "done",
] as const;

export type CycleStep = (typeof CYCLE_STEPS)[number];

export const BDD_STATES = ["pending", "fail", "pass"] as const;
export type BddState = (typeof BDD_STATES)[number];

export type FeatureStatus =
  | "pending"
  | "in_progress"
  | "blocked"
  | "deferred"
  | "done";

export interface Scenario {
  name: string;
  bdd: BddState;
  unit_tests: number;
}

export interface Feature {
  id: string;
  title: string;
  status: FeatureStatus;
  cycle_step: CycleStep;
  scenarios: Scenario[];
  note?: string;
}

export interface ProgressData {
  current_focus: string | null;
  features: Feature[];
}

export class ProgressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProgressError";
  }
}

export function load(progressFile = DEFAULT_PROGRESS_FILE): ProgressData {
  if (!existsSync(progressFile)) {
    return { current_focus: null, features: [] };
  }
  return JSON.parse(readFileSync(progressFile, "utf8")) as ProgressData;
}

export function save(data: ProgressData, progressFile = DEFAULT_PROGRESS_FILE): void {
  mkdirSync(dirname(progressFile), { recursive: true });
  writeFileSync(progressFile, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function findFeature(
  data: ProgressData,
  featureId: string,
): Feature | undefined {
  return data.features.find((f) => f.id === featureId);
}

export function frExistsInSpec(specContent: string, featureId: string): boolean {
  const pattern = new RegExp(`\\b${featureId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
  return pattern.test(specContent);
}

function requireFeature(data: ProgressData, featureId: string): Feature {
  const feature = findFeature(data, featureId);
  if (!feature) {
    throw new ProgressError(`Feature '${featureId}' not found.`);
  }
  return feature;
}

export function cmdCurrent(data: ProgressData): string {
  const focus = data.current_focus;
  if (!focus) {
    return "No current focus set.";
  }
  const feature = findFeature(data, focus);
  if (!feature) {
    return `Focus '${focus}' not found in features.`;
  }
  const lines = [
    `Focus:  ${feature.id} — ${feature.title}`,
    `Status: ${feature.status}`,
    `Step:   ${feature.cycle_step}`,
  ];
  if (feature.scenarios.length > 0) {
    lines.push(`Scenarios: ${feature.scenarios.length}`);
    for (const s of feature.scenarios) {
      const mark = { pass: "✓", fail: "✗", pending: "○" }[s.bdd];
      lines.push(`  ${mark} ${s.name} (bdd=${s.bdd}, units=${s.unit_tests})`);
    }
  }
  if (feature.note) {
    lines.push(`Note:   ${feature.note}`);
  }
  return lines.join("\n");
}

export function cmdStatus(data: ProgressData): string {
  const lines = [`Focus: ${data.current_focus ?? "none"}`, ""];
  for (const f of data.features) {
    const pass = f.scenarios.filter((s) => s.bdd === "pass").length;
    const total = f.scenarios.length;
    lines.push(
      `  [${f.status.padEnd(11)}] ${f.id} — ${f.title} (${f.cycle_step}, ${pass}/${total} scenarios)`,
    );
  }
  return lines.join("\n");
}

export function cmdShow(data: ProgressData, featureId: string): string {
  const feature = requireFeature(data, featureId);
  const lines = [
    `ID:     ${feature.id}`,
    `Title:  ${feature.title}`,
    `Status: ${feature.status}`,
    `Step:   ${feature.cycle_step}`,
  ];
  if (feature.note) {
    lines.push(`Note:   ${feature.note}`);
  }
  if (feature.scenarios.length > 0) {
    lines.push(`\nScenarios (${feature.scenarios.length}):`);
    for (const s of feature.scenarios) {
      const mark = { pass: "✓", fail: "✗", pending: "○" }[s.bdd];
      lines.push(`  ${mark} ${s.name}`);
      lines.push(`    bdd=${s.bdd}, unit_tests=${s.unit_tests}`);
    }
  }
  return lines.join("\n");
}

export function cmdAdvance(
  data: ProgressData,
  featureId: string,
  specFile = DEFAULT_SPEC_FILE,
): void {
  const feature = requireFeature(data, featureId);
  const idx = CYCLE_STEPS.indexOf(feature.cycle_step);
  if (idx < 0 || idx >= CYCLE_STEPS.length - 1) {
    throw new ProgressError(
      `Already at final step '${feature.cycle_step}'. Use 'done' to mark complete.`,
    );
  }
  const nextStep = CYCLE_STEPS[idx + 1];
  if (feature.cycle_step === "spec_review" && nextStep === "bdd_red") {
    const specContent = existsSync(specFile)
      ? readFileSync(specFile, "utf8")
      : "";
    if (!frExistsInSpec(specContent, featureId)) {
      throw new ProgressError(
        `Cannot advance: ${featureId} not found in SPEC.md. Add the FR before leaving spec_review.`,
      );
    }
  }
  feature.cycle_step = nextStep;
  if (feature.status === "pending") {
    feature.status = "in_progress";
  }
}

export function cmdScenario(
  data: ProgressData,
  state: string,
  featureId: string,
  name: string,
): void {
  if (!BDD_STATES.includes(state as BddState)) {
    throw new ProgressError(`Invalid state '${state}'. Must be one of: ${BDD_STATES.join(", ")}`);
  }
  const feature = requireFeature(data, featureId);
  const existing = feature.scenarios.find((s) => s.name === name);
  if (existing) {
    existing.bdd = state as BddState;
    return;
  }
  feature.scenarios.push({
    name,
    bdd: state as BddState,
    unit_tests: 0,
  });
}

export function cmdUnits(
  data: ProgressData,
  featureId: string,
  name: string,
  count: number,
): void {
  const feature = requireFeature(data, featureId);
  const scenario = feature.scenarios.find((s) => s.name === name);
  if (!scenario) {
    throw new ProgressError(`Scenario '${name}' not found in ${featureId}.`);
  }
  scenario.unit_tests = count;
}

export function cmdFocus(data: ProgressData, featureId: string): void {
  requireFeature(data, featureId);
  data.current_focus = featureId;
}

export function cmdAdd(data: ProgressData, featureId: string, title: string): void {
  if (findFeature(data, featureId)) {
    throw new ProgressError(`Feature '${featureId}' already exists.`);
  }
  data.features.push({
    id: featureId,
    title,
    status: "pending",
    cycle_step: "spec_review",
    scenarios: [],
  });
}

export function cmdDone(data: ProgressData, featureId: string): void {
  const feature = requireFeature(data, featureId);
  if (feature.scenarios.length === 0) {
    throw new ProgressError(`Cannot mark done: ${featureId} has no scenarios.`);
  }
  for (const s of feature.scenarios) {
    if (s.bdd !== "pass") {
      throw new ProgressError(
        `Cannot mark done: scenario '${s.name}' is not passing (bdd=${s.bdd}).`,
      );
    }
    if (s.unit_tests < 1) {
      throw new ProgressError(
        `Cannot mark done: scenario '${s.name}' has no unit tests.`,
      );
    }
  }
  feature.status = "done";
  feature.cycle_step = "done";
  if (data.current_focus === featureId) {
    data.current_focus = null;
  }
}

function print(message: string): void {
  process.stdout.write(`${message}\n`);
}

function die(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

export function runCli(argv: string[], progressFile = DEFAULT_PROGRESS_FILE): void {
  if (argv.length === 0) {
    print(__doc__);
    return;
  }

  const data = load(progressFile);
  const cmd = argv[0];

  try {
    if (cmd === "current") {
      print(cmdCurrent(data));
    } else if (cmd === "status") {
      print(cmdStatus(data));
    } else if (cmd === "show" && argv.length >= 2) {
      print(cmdShow(data, argv[1]));
    } else if (cmd === "advance" && argv.length >= 2) {
      cmdAdvance(data, argv[1]);
      save(data, progressFile);
      const feature = findFeature(data, argv[1])!;
      const prev = CYCLE_STEPS[CYCLE_STEPS.indexOf(feature.cycle_step) - 1];
      print(`${argv[1]}: ${prev} → ${feature.cycle_step}`);
    } else if (cmd === "scenario" && argv.length >= 4) {
      const state = argv[1];
      const featureId = argv[2];
      const name = argv.slice(3).join(" ");
      cmdScenario(data, state, featureId, name);
      save(data, progressFile);
      print(`${featureId} scenario '${name}': bdd → ${state}`);
    } else if (cmd === "units" && argv.length >= 5) {
      const featureId = argv[1];
      const count = Number(argv[argv.length - 1]);
      const name = argv.slice(2, -1).join(" ");
      if (!Number.isInteger(count) || count < 0) {
        die(`Invalid unit test count: ${argv[argv.length - 1]}`);
      }
      cmdUnits(data, featureId, name, count);
      save(data, progressFile);
      print(`${featureId} scenario '${name}': unit_tests → ${count}`);
    } else if (cmd === "focus" && argv.length >= 2) {
      cmdFocus(data, argv[1]);
      save(data, progressFile);
      print(`Focus → ${argv[1]}`);
    } else if (cmd === "add" && argv.length >= 3) {
      const featureId = argv[1];
      const title = argv.slice(2).join(" ");
      cmdAdd(data, featureId, title);
      save(data, progressFile);
      print(`Added: ${featureId} — ${title}`);
    } else if (cmd === "done" && argv.length >= 2) {
      cmdDone(data, argv[1]);
      save(data, progressFile);
      print(`${argv[1]}: marked done ✓`);
    } else {
      die(`Unknown command or missing arguments: ${argv.join(" ")}`);
    }
  } catch (error) {
    if (error instanceof ProgressError) {
      die(error.message);
    }
    throw error;
  }
}

const __doc__ = `Progress tracking CLI for the Spec → BDD → TDD development cycle.

Usage:
  npx tsx scripts/progress.ts current
  npx tsx scripts/progress.ts status
  npx tsx scripts/progress.ts show FR-xxx
  npx tsx scripts/progress.ts advance FR-xxx
  npx tsx scripts/progress.ts scenario pass FR-xxx "Scenario name"
  npx tsx scripts/progress.ts units FR-xxx "Scenario name" 3
  npx tsx scripts/progress.ts focus FR-xxx
  npx tsx scripts/progress.ts add FR-xxx "Title"
  npx tsx scripts/progress.ts done FR-xxx
`;

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runCli(process.argv.slice(2));
}
