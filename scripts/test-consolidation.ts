// scripts/test-consolidation.ts — Manual consolidation validation against a copied buddy instance.
//
// Usage:
//   npx tsx scripts/test-consolidation.ts [depth] [source-dir]
//   npx tsx scripts/test-consolidation.ts --dry-run [depth] [source-dir]
//
// Defaults: depth=1, source=fixtures/consolidation-test (clean fixture with 3 days of logs)
// Uses ~/.buddy/auth.json and ~/.buddy/prompts/ (same as the Buddy app).
//
// Simulate mode (H3 — FR-CONSOL-08/09, FR-COST-05) replaces the LLM with a
// scripted session: no auth, no cost, no network. It exists because the failure
// paths are the ones that spend a real user's money, and they are otherwise
// awkward to reproduce by hand — you would have to break the network at the
// right moment, or calibrate usage.json so one depth crosses the budget line.

import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { ModelRuntime } from "@earendil-works/pi-coding-agent";

import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

import {
  buildConsolidationPrompt,
  runConsolidation,
  type MaintenanceSessionLike,
} from "../backends/consolidation-runner";
import { lockPath } from "../backends/maintenance";
import { alignHttpDispatcherWithPi } from "../backends/pi-http-dispatcher";
import { assembleMaintenancePrompt } from "../backends/prompt";
import { createBuddyModelRuntime, defaultAuthPath } from "../backends/provider-auth";
import { bootRefreshIfNeeded } from "../backends/boot-refresh";
import { buddyAgentDir, globalConfigDir } from "../backends/global-config";
import { AGENT_TOOLS, EXCLUDED_TOOLS } from "../shared/defaults";
import {
  loadConsolidationLog,
  loadConsolidationState,
  saveConsolidationState,
} from "../shared/consolidation-state";

const VALID_DEPTHS = new Set([1, 2, 3]);

function printUsage(): void {
  console.log(`Usage:
  npx tsx scripts/test-consolidation.ts [options] [depth] [source-dir]

  depth       1 (daily), 2 (weekly), or 3 (monthly). Default: 1
  source-dir  buddy instance to copy. Default: fixtures/consolidation-test

  --date YYYY-MM-DD    Simulate a specific date (default: last log date)
  --dry-run            Print prompt preview only (no LLM call)

  Simulate mode — no auth, no cost, no network (H3):
  --fail-at-depth N    Scripted session throws at depth N (FR-CONSOL-08/09)
  --budget-stop-after N  Report the budget threshold crossed after N depths
                       have run, mid-cascade (FR-COST-05)
  --seed-failures N    Pre-seed N consecutive failures at the target depth,
                       to observe backoff (N<3) or abandonment (N>=3)

Examples:
  # depth 2 cascade where the weekly step fails: depth 1 must survive
  npx tsx scripts/test-consolidation.ts --fail-at-depth 2 2

  # depth 3 cascade that crosses the budget line after depth 1
  npx tsx scripts/test-consolidation.ts --budget-stop-after 1 3

  # target depth already past the retry ceiling: skipped, not attempted
  npx tsx scripts/test-consolidation.ts --seed-failures 3 1`);
}

interface SimulateOptions {
  failAtDepth?: number;
  budgetStopAfter?: number;
  seedFailures?: number;
}

function isSimulating(sim: SimulateOptions): boolean {
  return (
    sim.failAtDepth !== undefined ||
    sim.budgetStopAfter !== undefined ||
    sim.seedFailures !== undefined
  );
}

function parseArgs(argv: string[]): {
  dryRun: boolean;
  depth: 1 | 2 | 3;
  sourceDir: string;
  simulatedDate: Date | undefined;
  simulate: SimulateOptions;
} {
  const args = [...argv];
  let dryRun = false;
  let simulatedDate: Date | undefined;
  const simulate: SimulateOptions = {};

  function takeCount(flag: string): number {
    args.shift();
    const raw = args.shift();
    const value = Number.parseInt(raw ?? "", 10);
    if (!Number.isFinite(value) || value < 0) {
      console.error(`${flag} needs a non-negative number, got "${raw}".`);
      process.exit(1);
    }
    return value;
  }

  while (args.length > 0 && args[0]!.startsWith("--")) {
    if (args[0] === "--dry-run") {
      dryRun = true;
      args.shift();
    } else if (args[0] === "--fail-at-depth") {
      simulate.failAtDepth = takeCount("--fail-at-depth");
    } else if (args[0] === "--budget-stop-after") {
      simulate.budgetStopAfter = takeCount("--budget-stop-after");
    } else if (args[0] === "--seed-failures") {
      simulate.seedFailures = takeCount("--seed-failures");
    } else if (args[0] === "--date" && args[1]) {
      args.shift();
      const dateStr = args.shift()!;
      const parsed = new Date(`${dateStr}T12:00:00`);
      if (Number.isNaN(parsed.getTime())) {
        console.error(`Invalid date: "${dateStr}". Use YYYY-MM-DD.`);
        process.exit(1);
      }
      simulatedDate = parsed;
    } else if (args[0] === "--help" || args[0] === "-h") {
      printUsage();
      process.exit(0);
    } else {
      break;
    }
  }

  const depthRaw = args[0] ?? "1";
  const depth = Number.parseInt(depthRaw, 10);
  if (!VALID_DEPTHS.has(depth)) {
    console.error(`Invalid depth "${depthRaw}". Use 1, 2, or 3.`);
    printUsage();
    process.exit(1);
  }

  const scriptDir = new URL(".", import.meta.url).pathname;
  const defaultFixture = resolve(scriptDir, "..", "fixtures", "consolidation-test");
  const sourceDir = resolve(args[1] ?? defaultFixture);
  if (!existsSync(sourceDir)) {
    console.error(`Source directory not found: ${sourceDir}`);
    process.exit(1);
  }

  return { dryRun, depth: depth as 1 | 2 | 3, sourceDir, simulatedDate, simulate };
}

/**
 * Scripted stand-in for the maintenance session. Reads the depth back out of
 * the prompt so the fake behaves per-depth without the runner having to expose
 * one.
 */
function createScriptedSession(
  sim: SimulateOptions,
  onDepth: (depth: number) => void,
): MaintenanceSessionLike {
  return {
    async prompt(text: string) {
      const depth = Number(/Run consolidation at depth (\d)/.exec(text)?.[1] ?? 0);
      onDepth(depth);
      console.log(`  [simulated] depth ${depth} prompted (${text.length} chars, no LLM call)`);
      if (sim.failAtDepth === depth) {
        throw new Error(`simulated failure at depth ${depth}`);
      }
    },
    dispose: () => {},
  };
}

async function runSimulated(
  testDir: string,
  depth: 1 | 2 | 3,
  now: Date,
  sim: SimulateOptions,
): Promise<void> {
  if (sim.seedFailures !== undefined) {
    const state = loadConsolidationState(testDir);
    state.failures = {
      [String(depth)]: { count: sim.seedFailures, lastFailureAt: now.toISOString() },
    };
    saveConsolidationState(testDir, state);
    console.log(`Seeded ${sim.seedFailures} consecutive failure(s) at depth ${depth}.`);
  }

  const promptedDepths: number[] = [];
  const result = await runConsolidation({
    rootDir: testDir,
    targetDepth: depth,
    modelRuntime: {} as never,
    now,
    createSession: async () =>
      createScriptedSession(sim, (d) => {
        promptedDepths.push(d);
      }),
    isBudgetNearLimit:
      sim.budgetStopAfter === undefined
        ? undefined
        : () => promptedDepths.length >= sim.budgetStopAfter!,
  });

  console.log("\n--- Result ---");
  console.log(`  ran:             ${result.ran}`);
  console.log(`  depths prompted: ${promptedDepths.join(", ") || "(none)"}`);
  console.log(`  completed:       ${result.completedDepths.join(", ") || "(none)"}`);
  const outcome =
    result.stoppedBy ?? (promptedDepths.length === 0 ? "nothing attempted — all depths skipped" : "ran to completion");
  console.log(`  stopped by:      ${outcome}`);
  console.log(`  abandoned:       ${result.abandonedDepths.join(", ") || "(none)"}`);

  const persisted = loadConsolidationState(testDir);
  console.log("\n--- Persisted state (.buddy/consolidation-state.json) ---");
  console.log(`  lastDepth1: ${persisted.lastDepth1 ?? "null"}`);
  console.log(`  lastDepth2: ${persisted.lastDepth2 ?? "null"}`);
  console.log(`  lastDepth3: ${persisted.lastDepth3 ?? "null"}`);
  console.log(`  failures:   ${JSON.stringify(persisted.failures ?? {})}`);

  console.log("\n--- Journal (.buddy/consolidation-log.json) ---");
  for (const entry of loadConsolidationLog(testDir)) {
    console.log(`  depth ${entry.depth}: ${entry.status}${entry.error ? ` — ${entry.error}` : ""}`);
  }

  console.log(`\nInspect at: ${testDir}`);
}

function prepareFixture(sourceDir: string): string {
  const testDir = mkdtempSync(join(tmpdir(), "ab-consol-test-"));
  console.log(`Copying ${sourceDir} → ${testDir}`);
  cpSync(sourceDir, testDir, { recursive: true });

  const lock = lockPath(testDir);
  if (existsSync(lock)) {
    unlinkSync(lock);
    console.log("Removed stale maintenance.lock from copy");
  }

  if (!existsSync(join(testDir, ".git"))) {
    execSync("git init && git add -A && git commit -m 'fixture baseline'", {
      cwd: testDir,
      stdio: "pipe",
    });
    console.log("Initialized git repo on fixture copy (baseline commit).");
  }

  return testDir;
}

function detectLastLogDate(testDir: string): Date {
  const logsDir = join(testDir, "logs");
  const logFiles = readdirSync(logsDir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort();
  if (logFiles.length === 0) {
    console.warn("No log files found — using today's date.");
    return new Date();
  }
  const lastDate = logFiles[logFiles.length - 1]!.replace(".md", "");
  return new Date(`${lastDate}T20:00:00`);
}

function getHeadSha(dir: string): string {
  try {
    return execSync("git rev-parse HEAD", { cwd: dir, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function showChanges(testDir: string, baselineSha: string): void {
  if (!baselineSha) {
    console.log("\n--- Changes ---\n (no baseline SHA — cannot diff)");
    return;
  }

  try {
    const log = execSync(`git log --oneline ${baselineSha}..HEAD`, {
      cwd: testDir,
      encoding: "utf8",
    });
    console.log("\n--- Commits made during consolidation ---\n", log.trim() || "(none)");
  } catch {
    console.log("\n--- Changes ---\n (git log unavailable)");
    return;
  }

  try {
    const stat = execSync(`git diff --stat ${baselineSha}..HEAD`, {
      cwd: testDir,
      encoding: "utf8",
    });
    console.log("\n--- Files changed ---\n", stat.trim() || "(no file changes)");
  } catch {
    return;
  }

  try {
    const fullDiff = execSync(`git diff ${baselineSha}..HEAD`, {
      cwd: testDir,
      encoding: "utf8",
    });
    if (fullDiff.trim()) {
      const outPath = join(testDir, "consolidation-diff.patch");
      writeFileSync(outPath, fullDiff);
      console.log(`Full diff saved to: ${outPath}`);
    }
  } catch {
    // stat already printed
  }
}

async function main(): Promise<void> {
  const { dryRun, depth, sourceDir, simulatedDate, simulate } = parseArgs(process.argv.slice(2));
  const testDir = prepareFixture(sourceDir);
  const now = simulatedDate ?? detectLastLogDate(testDir);
  console.log(`Test directory: ${testDir}`);
  console.log(`Simulated date: ${now.toISOString().slice(0, 10)} (${simulatedDate ? "from --date" : "auto-detected from last log"})`);

  if (isSimulating(simulate)) {
    console.log("Simulate mode: scripted session, no auth, no cost, no network.\n");
    await runSimulated(testDir, depth, now, simulate);
    return;
  }

  if (dryRun) {
    const preview = buildConsolidationPrompt(testDir, depth, now);
    console.log(`\n--- Prompt preview (depth ${depth}, first 1200 chars) ---\n`);
    console.log(preview.slice(0, 1200));
    if (preview.length > 1200) console.log("\n... (truncated)");
    console.log(`\nDry run complete. Inspect fixture at: ${testDir}`);
    return;
  }

  bootRefreshIfNeeded(globalConfigDir());
  await alignHttpDispatcherWithPi();

  const authPath = defaultAuthPath();
  if (!existsSync(authPath)) {
    console.error(`Auth file not found: ${authPath}`);
    console.error("Configure a provider in Buddy first.");
    process.exit(1);
  }

  console.log(`Auth: ${authPath}`);
  console.log(`Running consolidation at depth ${depth}...`);

  const baselineSha = getHeadSha(testDir);
  // NFR-SEC-19: build it exactly as the app does. `ModelRuntime.create({
  // authPath })` would default `modelsPath` to the Pi CLI's
  // ~/.pi/agent/models.json — so this script would read the user's personal
  // provider definitions and, worse for its purpose, never see Buddy's own
  // ~/.buddy/models.json, which is where a custom endpoint is configured.
  const modelRuntime = await createBuddyModelRuntime();
  const start = Date.now();

  try {
    const result = await runConsolidation({
      rootDir: testDir,
      targetDepth: depth,
      modelRuntime,
      now,
      async createSession({ rootDir: rd, modelRuntime: mr }) {
        const sysPrompt = assembleMaintenancePrompt(rd);
        console.log(`\n--- System prompt (${sysPrompt.length} chars) ---`);
        console.log(sysPrompt.slice(0, 500));
        if (sysPrompt.length > 500) console.log("...(truncated)");

        const rl = new DefaultResourceLoader({
          cwd: rd,
          agentDir: buddyAgentDir(), // NFR-SEC-19
          systemPromptOverride: () => sysPrompt,
        });
        await rl.reload();

        const { session } = await createAgentSession({
          cwd: rd,
          resourceLoader: rl,
          sessionManager: SessionManager.create(rd),
          excludeTools: [...EXCLUDED_TOOLS],
          tools: [...AGENT_TOOLS],
          modelRuntime: mr,
        });

        const allEvents: Array<{ type: string; [k: string]: unknown }> = [];
        const textChunks: string[] = [];
        const toolCalls: string[] = [];
        session.subscribe((event) => {
          allEvents.push(event);
          if (event.type === "text" && typeof event.text === "string") {
            textChunks.push(event.text);
          } else if (event.type === "tool_use_begin") {
            toolCalls.push(String(event.name ?? "unknown"));
          }
        });

        const wrapper: MaintenanceSessionLike = {
          async prompt(text) {
            console.log(`\n--- User prompt (${text.length} chars) ---\n`);
            try {
              await session.prompt(text);
            } catch (err) {
              console.error(`\n!!! session.prompt() threw:`, err);
            }
            const fullText = textChunks.join("");
            console.log(`\n--- LLM response (${fullText.length} chars, ${toolCalls.length} tool calls) ---`);
            console.log(`--- Total events received: ${allEvents.length} ---`);
            const eventTypes = allEvents.map((e) => e.type);
            const typeCounts: Record<string, number> = {};
            for (const t of eventTypes) typeCounts[t] = (typeCounts[t] ?? 0) + 1;
            console.log(`--- Event types:`, JSON.stringify(typeCounts), "---");
            if (allEvents.length <= 20) {
              for (const e of allEvents) {
                const { type, ...rest } = e;
                const preview = JSON.stringify(rest).slice(0, 200);
                console.log(`  [${type}] ${preview}`);
              }
            }
            if (toolCalls.length > 0) {
              console.log(`Tools used: ${toolCalls.join(", ")}`);
            }
            if (fullText.length > 0) {
              console.log(fullText.slice(0, 2000));
              if (fullText.length > 2000) console.log("\n...(truncated)");
            }
            textChunks.length = 0;
            toolCalls.length = 0;
            allEvents.length = 0;
          },
          dispose: () => session.dispose(),
        };
        return wrapper;
      },
    });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(
      `Done in ${elapsed}s — ran: ${result.ran}, completed depths: ${result.completedDepths.join(", ") || "(none)"}`,
    );
    showChanges(testDir, baselineSha);
    console.log(`\nInspect results at: ${testDir}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Consolidation failed: ${message}`);
    console.error(`Partial state may remain in: ${testDir}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
