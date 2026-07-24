// scripts/test-consolidation.ts — Manual consolidation validation against a copied AB instance.
//
// Usage:
//   npx tsx scripts/test-consolidation.ts [depth] [source-dir]
//   npx tsx scripts/test-consolidation.ts --dry-run [depth] [source-dir]
//
// Defaults: depth=1, source=~/git/my-ab
// Uses ~/.buddy/auth.json and ~/.buddy/prompts/ (same as the Buddy app).

import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { ModelRuntime } from "@earendil-works/pi-coding-agent";

import { buildConsolidationPrompt, runConsolidation } from "../backends/consolidation-runner";
import { lockPath } from "../backends/maintenance";
import { alignHttpDispatcherWithPi } from "../backends/pi-http-dispatcher";
import { defaultAuthPath } from "../backends/provider-auth";
import { ensureSchema } from "../backends/schema-migration";

const VALID_DEPTHS = new Set([1, 2, 3]);

function printUsage(): void {
  console.log(`Usage:
  npx tsx scripts/test-consolidation.ts [--dry-run] [depth] [source-dir]

  depth       1 (daily), 2 (weekly), or 3 (monthly). Default: 1
  source-dir  AB instance to copy. Default: ~/git/my-ab
  --dry-run   Copy fixture and print prompt preview only (no LLM call)`);
}

function parseArgs(argv: string[]): { dryRun: boolean; depth: 1 | 2 | 3; sourceDir: string } {
  const args = [...argv];
  let dryRun = false;
  if (args[0] === "--dry-run") {
    dryRun = true;
    args.shift();
  }
  if (args[0] === "--help" || args[0] === "-h") {
    printUsage();
    process.exit(0);
  }

  const depthRaw = args[0] ?? "1";
  const depth = Number.parseInt(depthRaw, 10);
  if (!VALID_DEPTHS.has(depth)) {
    console.error(`Invalid depth "${depthRaw}". Use 1, 2, or 3.`);
    printUsage();
    process.exit(1);
  }

  const sourceDir = resolve(args[1] ?? join(homedir(), "git", "my-ab"));
  if (!existsSync(sourceDir)) {
    console.error(`Source directory not found: ${sourceDir}`);
    process.exit(1);
  }

  return { dryRun, depth: depth as 1 | 2 | 3, sourceDir };
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
    console.warn("Warning: copy has no .git — commits during consolidation will fail.");
  }

  return testDir;
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
  const { dryRun, depth, sourceDir } = parseArgs(process.argv.slice(2));
  const testDir = prepareFixture(sourceDir);
  console.log(`Test directory: ${testDir}`);

  if (dryRun) {
    const preview = buildConsolidationPrompt(testDir, depth);
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
