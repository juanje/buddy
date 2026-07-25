// scripts/test-consolidation.ts — Manual consolidation validation against a copied AB instance.
//
// Usage:
//   npx tsx scripts/test-consolidation.ts [depth] [source-dir]
//   npx tsx scripts/test-consolidation.ts --dry-run [depth] [source-dir]
//
// Defaults: depth=1, source=fixtures/consolidation-test (clean fixture with 3 days of logs)
// Uses ~/.buddy/auth.json and ~/.buddy/prompts/ (same as the Buddy app).

import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { ModelRuntime } from "@earendil-works/pi-coding-agent";

import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
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
import { defaultAuthPath } from "../backends/provider-auth";
import { ensureSchema } from "../backends/schema-migration";
import { AGENT_TOOLS, EXCLUDED_TOOLS } from "../shared/defaults";

const VALID_DEPTHS = new Set([1, 2, 3]);

function printUsage(): void {
  console.log(`Usage:
  npx tsx scripts/test-consolidation.ts [--dry-run] [--date YYYY-MM-DD] [depth] [source-dir]

  depth       1 (daily), 2 (weekly), or 3 (monthly). Default: 1
  source-dir  AB instance to copy. Default: fixtures/consolidation-test
  --date      Simulate a specific date (default: last log date in the fixture)
  --dry-run   Copy fixture and print prompt preview only (no LLM call)`);
}

function parseArgs(argv: string[]): {
  dryRun: boolean;
  depth: 1 | 2 | 3;
  sourceDir: string;
  simulatedDate: Date | undefined;
} {
  const args = [...argv];
  let dryRun = false;
  let simulatedDate: Date | undefined;

  while (args.length > 0 && args[0]!.startsWith("--")) {
    if (args[0] === "--dry-run") {
      dryRun = true;
      args.shift();
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

  return { dryRun, depth: depth as 1 | 2 | 3, sourceDir, simulatedDate };
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
  const { dryRun, depth, sourceDir, simulatedDate } = parseArgs(process.argv.slice(2));
  const testDir = prepareFixture(sourceDir);
  const now = simulatedDate ?? detectLastLogDate(testDir);
  console.log(`Test directory: ${testDir}`);
  console.log(`Simulated date: ${now.toISOString().slice(0, 10)} (${simulatedDate ? "from --date" : "auto-detected from last log"})`);

  if (dryRun) {
    const preview = buildConsolidationPrompt(testDir, depth, now);
    console.log(`\n--- Prompt preview (depth ${depth}, first 1200 chars) ---\n`);
    console.log(preview.slice(0, 1200));
    if (preview.length > 1200) console.log("\n... (truncated)");
    console.log(`\nDry run complete. Inspect fixture at: ${testDir}`);
    return;
  }

  ensureSchema();
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
  const modelRuntime = await ModelRuntime.create({ authPath });
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
          agentDir: getAgentDir(),
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
