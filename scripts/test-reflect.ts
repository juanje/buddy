// scripts/test-reflect.ts — Evaluate process-conversation reflect output against fixture conversations.
//
// Usage:
//   npx tsx scripts/test-reflect.ts [fixture-name|fixture-path]
//   npx tsx scripts/test-reflect.ts --all
//   npx tsx scripts/test-reflect.ts --dry-run [fixture]
//
// Fixtures live in fixtures/reflect-test/*.jsonl (one JSON message per line).
// Each fixture simulates a conversation that the reflect child must summarize.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

import { buildReflectUserPrompt } from "../backends/reflect-prompts";
import { assembleMaintenancePrompt } from "../backends/prompt";
import { alignHttpDispatcherWithPi } from "../backends/pi-http-dispatcher";
import { createBuddyModelRuntime, defaultAuthPath } from "../backends/provider-auth";
import { bootRefreshIfNeeded } from "../backends/boot-refresh";
import { buddyAgentDir, globalConfigDir, globalConfigPath } from "../backends/global-config";
import { resolveSessionModel } from "../backends/model-switch";
import { readStateFile } from "../backends/state-file";
import type { SetupConfig } from "../shared/api";
import { AGENT_TOOLS, EXCLUDED_TOOLS } from "../shared/defaults";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { cpSync, mkdirSync } from "node:fs";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const FIXTURES_DIR = resolve(new URL(".", import.meta.url).pathname, "..", "fixtures", "reflect-test");

function loadFixture(path: string): Message[] {
  const content = readFileSync(path, "utf8");
  return content
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Message);
}

function listFixtures(): string[] {
  if (!existsSync(FIXTURES_DIR)) return [];
  return readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".jsonl"))
    .sort();
}

function resolveFixturePath(name: string): string {
  if (existsSync(name)) return resolve(name);
  const withExt = name.endsWith(".jsonl") ? name : `${name}.jsonl`;
  const inDir = join(FIXTURES_DIR, withExt);
  if (existsSync(inDir)) return inDir;
  console.error(`Fixture not found: "${name}"`);
  console.error(`Available: ${listFixtures().join(", ")}`);
  process.exit(1);
}

function printUsage(): void {
  console.log(`Usage:
  npx tsx scripts/test-reflect.ts [fixture-name]    Run reflect on a single fixture
  npx tsx scripts/test-reflect.ts --all             Run reflect on all fixtures
  npx tsx scripts/test-reflect.ts --dry-run [name]  Show prompt without calling LLM
  npx tsx scripts/test-reflect.ts --list            List available fixtures

Fixtures: ${FIXTURES_DIR}`);
}

function buildConversationContext(messages: Message[]): string {
  return messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");
}

function createMinimalBrainDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "reflect-eval-"));
  mkdirSync(join(dir, "agent_brain", "identity"), { recursive: true });
  mkdirSync(join(dir, "logs"), { recursive: true });
  writeFileSync(join(dir, "agent_brain", "identity", "SOUL.md"), "You are Buddy, a personal assistant.");
  writeFileSync(join(dir, "agent_brain", "identity", "USER.md"), "- **Name:** Juanje\n");
  return dir;
}

async function runReflectEval(fixturePath: string, dryRun: boolean): Promise<string> {
  const messages = loadFixture(fixturePath);
  const name = basename(fixturePath, ".jsonl");

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Fixture: ${name} (${messages.length} messages)`);
  console.log(`${"=".repeat(60)}`);

  const conversationContext = buildConversationContext(messages);
  const reflectPrompt = buildReflectUserPrompt("session-end");

  // The reflect child sees: system prompt (identity) + conversation history + reflect instruction
  const fullUserPrompt = `Here is the conversation to process:\n\n---\n${conversationContext}\n---\n\n${reflectPrompt}`;

  if (dryRun) {
    console.log(`\n--- Reflect prompt (${fullUserPrompt.length} chars) ---\n`);
    console.log(fullUserPrompt);
    return "";
  }

  bootRefreshIfNeeded(globalConfigDir());
  await alignHttpDispatcherWithPi();

  const authPath = defaultAuthPath();
  if (!existsSync(authPath)) {
    console.error(`Auth file not found: ${authPath}. Configure a provider in Buddy first.`);
    process.exit(1);
  }

  const brainDir = createMinimalBrainDir();
  const sysPrompt = assembleMaintenancePrompt(brainDir);

  const rl = new DefaultResourceLoader({
    cwd: brainDir,
    agentDir: buddyAgentDir(), // NFR-SEC-19
    systemPromptOverride: () => sysPrompt,
  });
  await rl.reload();

  const modelRuntime = await createBuddyModelRuntime();
  const appConfig = readStateFile<SetupConfig>(globalConfigPath());
  if (!appConfig?.provider || !appConfig?.model) {
    console.error("Could not read provider/model from config. Run Buddy setup first.");
    process.exit(1);
  }

  const { session } = await createAgentSession({
    cwd: brainDir,
    resourceLoader: rl,
    sessionManager: SessionManager.create(brainDir),
    excludeTools: [...EXCLUDED_TOOLS, ...AGENT_TOOLS],
    tools: [],
    modelRuntime,
  });

  const sessionModel = await resolveSessionModel(modelRuntime, appConfig.provider, appConfig.model);
  await session.setModel(sessionModel);
  console.log(`Model: ${appConfig.provider}/${appConfig.model}`);

  let assistantOutput = "";
  session.subscribe((event) => {
    if (event.type === "text" && typeof event.text === "string") {
      assistantOutput += event.text;
    }
    // Toolless sessions: final assistant content arrives in message_end
    if (event.type === "message_end") {
      const msg = (event as { message?: { role?: string; content?: Array<{ type: string; text?: string }> } }).message;
      if (msg?.role === "assistant" && msg.content) {
        for (const block of msg.content) {
          if (block.type === "text" && block.text) {
            assistantOutput = block.text;
          }
        }
      }
    }
  });

  const start = Date.now();
  await session.prompt(fullUserPrompt);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  const output = assistantOutput;
  session.dispose();

  console.log(`\n--- Output (${output.length} chars, ${elapsed}s) ---\n`);
  console.log(output);
  console.log(`\n--- End: ${name} ---\n`);

  return output;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printUsage();
    process.exit(0);
  }

  if (args[0] === "--list") {
    const fixtures = listFixtures();
    console.log(`Available fixtures (${fixtures.length}):`);
    for (const f of fixtures) console.log(`  ${f.replace(".jsonl", "")}`);
    process.exit(0);
  }

  const dryRun = args.includes("--dry-run");
  const runAll = args.includes("--all");
  const filteredArgs = args.filter((a) => !a.startsWith("--"));

  if (runAll) {
    const fixtures = listFixtures();
    if (fixtures.length === 0) {
      console.error(`No fixtures found in ${FIXTURES_DIR}`);
      process.exit(1);
    }
    console.log(`Running ${fixtures.length} fixtures...`);
    const results: Record<string, string> = {};
    for (const f of fixtures) {
      const path = join(FIXTURES_DIR, f);
      results[f] = await runReflectEval(path, dryRun);
    }
    if (!dryRun) {
      const outPath = join(FIXTURES_DIR, `eval-results-${new Date().toISOString().slice(0, 10)}.md`);
      let md = `# Reflect eval results — ${new Date().toISOString().slice(0, 10)}\n\n`;
      for (const [fixture, output] of Object.entries(results)) {
        md += `## ${fixture.replace(".jsonl", "")}\n\n${output}\n\n---\n\n`;
      }
      writeFileSync(outPath, md);
      console.log(`\nResults saved to: ${outPath}`);
    }
  } else {
    const fixtureName = filteredArgs[0] ?? "trivial-greeting";
    const path = resolveFixturePath(fixtureName);
    await runReflectEval(path, dryRun);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
