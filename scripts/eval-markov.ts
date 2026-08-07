// scripts/eval-markov.ts — FR-BRAIN-11: Working memory precision eval.
//
// Measures whether a Buddy instance's working memory (USER.md + concepts) is
// accurate and current. Two question types:
//
//   profile  — stable facts that should be in memory (identity, work, health)
//   currency — facts that evolved over time; tests that memory reflects the
//              CURRENT state, not a stale version. A gap means consolidation
//              hasn't updated memory with information that's already in the logs.
//
// Questions are loaded from a JSON file (default: <buddy-dir>/eval-questions.json).
// This keeps instance-specific data out of the codebase and allows different
// question banks per Buddy instance.
//
// Usage:
//   npx tsx scripts/eval-markov.ts [options] <buddy-dir>
//   npx tsx scripts/eval-markov.ts --dry-run fixtures/consolidation-test
//   npx tsx scripts/eval-markov.ts --verbose ~/buddy
//   npx tsx scripts/eval-markov.ts --questions path/to/questions.json ~/buddy
//
// Options:
//   --dry-run                   Show questions and context stats, no LLM calls
//   --verbose / -v              Show event types and answer previews
//   --questions / -q <file>     Path to questions JSON (default: <buddy-dir>/eval-questions.json)
//   --help

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import type { ModelRuntime } from "@earendil-works/pi-coding-agent";
import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

import { alignHttpDispatcherWithPi } from "../backends/pi-http-dispatcher";
import { collectAssistantText } from "../backends/pi-utils";
import { createBuddyModelRuntime, defaultAuthPath } from "../backends/provider-auth";
import { bootRefreshIfNeeded } from "../backends/boot-refresh";
import { buddyAgentDir, globalConfigDir, globalConfigPath } from "../backends/global-config";
import { resolveSessionModel } from "../backends/model-switch";
import { readStateFile } from "../backends/state-file";
import type { SetupConfig } from "../shared/api";

// --- Question bank ---

export interface EvalQuestion {
  id: string;
  question: string;
  domain: "profile" | "currency";
  expectedKeywords: string[];
}

function loadQuestions(questionsPath: string): EvalQuestion[] {
  if (!existsSync(questionsPath)) {
    console.error(`Questions file not found: ${questionsPath}`);
    console.error("Create an eval-questions.json in the buddy directory or pass --questions <path>.");
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(questionsPath, "utf8"));
  if (!Array.isArray(raw) || raw.length === 0) {
    console.error(`Questions file is empty or not an array: ${questionsPath}`);
    process.exit(1);
  }
  for (const q of raw) {
    if (!q.id || !q.question || !q.domain || !Array.isArray(q.expectedKeywords)) {
      console.error(`Invalid question entry: ${JSON.stringify(q)}`);
      process.exit(1);
    }
  }
  return raw as EvalQuestion[];
}

// --- Context builders ---

export function buildMemoryContext(buddyDir: string): string {
  const parts: string[] = [];

  const userMd = join(buddyDir, "agent_brain", "identity", "USER.md");
  if (existsSync(userMd)) {
    parts.push("=== USER.md ===\n" + readFileSync(userMd, "utf8"));
  }

  const conceptsIndex = join(buddyDir, "agent_brain", "concepts", "index.md");
  if (existsSync(conceptsIndex)) {
    parts.push("=== concepts/index.md ===\n" + readFileSync(conceptsIndex, "utf8"));
  }

  return parts.join("\n\n");
}

export function buildFullContext(buddyDir: string): string {
  const memoryCtx = buildMemoryContext(buddyDir);

  const logsDir = join(buddyDir, "logs");
  if (!existsSync(logsDir)) return memoryCtx;

  const logFiles = readdirSync(logsDir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort();

  const logParts = logFiles.map((f) => readFileSync(join(logsDir, f), "utf8"));

  return memoryCtx + "\n\n=== LOGS ===\n" + logParts.join("\n---\n");
}

// --- Eval runner ---

interface EvalResult {
  questionId: string;
  question: string;
  domain: "profile" | "currency";
  memoryAnswer: string;
  fullAnswer: string;
  memoryHits: string[];
  memoryMisses: string[];
  fullHits: string[];
  fullMisses: string[];
  gap: boolean;
  error?: string;
}

function checkKeywords(
  answer: string,
  keywords: string[],
): { hits: string[]; misses: string[] } {
  const lower = answer.toLowerCase();
  const hits: string[] = [];
  const misses: string[] = [];
  for (const kw of keywords) {
    if (lower.includes(kw.toLowerCase())) hits.push(kw);
    else misses.push(kw);
  }
  return { hits, misses };
}

const EVAL_SYSTEM_PROMPT = `You are answering factual questions about a person based only on the context provided.
Answer concisely (2-3 sentences). If the context does not contain enough information to answer, say "I don't have enough information to answer this."
Do not guess or infer beyond what the context explicitly states.`;

type RawEvent = { type: string; [k: string]: unknown };

function extractTextFromEvents(events: RawEvent[]): string {
  // Strategy 1: message_update → text_delta (streaming sessions)
  const fromDeltas = collectAssistantText(events);
  if (fromDeltas) return fromDeltas;

  // Strategy 2: message_end → message.content[].text (toolless sessions
  // emit the full response here instead of streaming deltas)
  for (const event of events) {
    if (event.type === "message_end") {
      const msg = event.message as
        | { role?: string; content?: Array<{ type: string; text?: string }> }
        | undefined;
      if (msg?.role === "assistant" && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === "text" && block.text) {
            return block.text.trim();
          }
        }
      }
    }
  }

  // Strategy 3: direct text events (older Pi SDK versions)
  let fromText = "";
  for (const event of events) {
    if (event.type === "text" && typeof event.text === "string") {
      fromText += event.text;
    }
  }
  if (fromText) return fromText.trim();

  return "";
}

interface SessionModel {
  id: string;
  provider: string;
}

async function askModel(
  modelRuntime: ModelRuntime,
  sessionModel: SessionModel,
  context: string,
  question: string,
  sessionDir: string,
  verbose: boolean,
): Promise<string> {
  const rl = new DefaultResourceLoader({
    cwd: sessionDir,
    agentDir: buddyAgentDir(),
    systemPromptOverride: () => EVAL_SYSTEM_PROMPT,
  });
  await rl.reload();

  const { session } = await createAgentSession({
    cwd: sessionDir,
    resourceLoader: rl,
    sessionManager: SessionManager.create(sessionDir),
    excludeTools: [],
    tools: [],
    modelRuntime,
  });

  await session.setModel(sessionModel);

  const promptText = `Context:\n${context}\n\nQuestion: ${question}`;
  const events: RawEvent[] = [];
  const unsub = session.subscribe((event) => events.push(event));

  try {
    await session.prompt(promptText);
  } finally {
    unsub();
  }

  const answer = extractTextFromEvents(events);

  if (verbose) {
    const uniqueTypes = [...new Set(events.map((e) => e.type))];
    console.log(`    [debug] ${events.length} events, types: ${uniqueTypes.join(", ")}`);
    if (answer) {
      console.log(`    [debug] answer (${answer.length} chars): ${answer.slice(0, 150)}...`);
    } else {
      console.log("    [debug] WARNING: no text extracted from events");
    }
  }

  session.dispose();
  return answer;
}

function printReport(results: EvalResult[]): void {
  const profileQs = results.filter((r) => r.domain === "profile");
  const currencyQs = results.filter((r) => r.domain === "currency");
  const errors = results.filter((r) => r.error);
  const valid = results.filter((r) => !r.error);
  const gaps = valid.filter((r) => r.gap);

  console.log("\n========================================");
  console.log("  Working Memory Precision Eval Report");
  console.log("========================================\n");

  console.log(`Questions: ${results.length} (${profileQs.length} profile, ${currencyQs.length} currency)`);
  if (errors.length > 0) {
    console.log(`\n⚠ ERRORS: ${errors.length} question(s) produced broken results:`);
    for (const e of errors) {
      console.log(`  - [${e.questionId}] ${e.error}`);
    }
    console.log();
  }
  console.log(`Gaps: ${gaps.length}/${valid.length}\n`);

  const profileGaps = gaps.filter((r) => r.domain === "profile");
  const currencyGaps = gaps.filter((r) => r.domain === "currency");
  const validProfile = valid.filter((r) => r.domain === "profile");
  const validCurrency = valid.filter((r) => r.domain === "currency");

  console.log(`Profile gaps: ${profileGaps.length}/${validProfile.length} — missing facts in USER.md / concepts`);
  if (profileGaps.length > 0) {
    for (const g of profileGaps) {
      console.log(`  - [${g.questionId}] ${g.question}`);
      console.log(`    Missing: ${g.memoryMisses.join(", ")}`);
    }
  }

  console.log(`Currency gaps: ${currencyGaps.length}/${validCurrency.length} — stale or outdated info in memory`);
  if (currencyGaps.length > 0) {
    for (const g of currencyGaps) {
      console.log(`  - [${g.questionId}] ${g.question}`);
      console.log(`    Stale: ${g.memoryMisses.join(", ")} (logs have: ${g.fullHits.join(", ")})`);
    }
  }

  console.log("\n--- Detail ---\n");
  for (const r of results) {
    if (r.error) {
      console.log(`[${r.questionId}] (${r.domain}) ERROR: ${r.question}`);
      console.log(`  ${r.error}`);
      console.log();
      continue;
    }
    const status = r.gap ? "GAP" : "OK";
    console.log(`[${r.questionId}] (${r.domain}) ${status}: ${r.question}`);
    console.log(`  Memory hits: ${r.memoryHits.join(", ") || "(none)"}`);
    console.log(`  Memory misses: ${r.memoryMisses.join(", ") || "(none)"}`);
    if (r.gap) {
      console.log(`  Full hits: ${r.fullHits.join(", ") || "(none)"}`);
    }
    console.log();
  }

  if (valid.length > 0) {
    const score = ((valid.length - gaps.length) / valid.length * 100).toFixed(1);
    console.log(`Memory precision: ${score}% (${valid.length - gaps.length}/${valid.length} accurate from memory)`);
    if (validProfile.length > 0) {
      const pScore = ((validProfile.length - profileGaps.length) / validProfile.length * 100).toFixed(1);
      console.log(`  Profile: ${pScore}%`);
    }
    if (validCurrency.length > 0) {
      const cScore = ((validCurrency.length - currencyGaps.length) / validCurrency.length * 100).toFixed(1);
      console.log(`  Currency: ${cScore}%`);
    }
  }
  if (errors.length > 0) {
    console.log(`\n⚠ ${errors.length} question(s) had extraction errors — score based on ${valid.length}/${results.length} valid results only.`);
  }
  console.log();
}

// --- CLI ---

function parseArgs(argv: string[]): { dryRun: boolean; verbose: boolean; buddyDir: string; questionsPath: string } {
  const args = [...argv];
  let dryRun = false;
  let verbose = false;
  let questionsOverride: string | undefined;

  while (args.length > 0 && args[0]!.startsWith("-")) {
    if (args[0] === "--dry-run") {
      dryRun = true;
      args.shift();
    } else if (args[0] === "--verbose" || args[0] === "-v") {
      verbose = true;
      args.shift();
    } else if (args[0] === "--questions" || args[0] === "-q") {
      args.shift();
      questionsOverride = args.shift();
      if (!questionsOverride) {
        console.error("--questions requires a path argument");
        process.exit(1);
      }
    } else if (args[0] === "--help" || args[0] === "-h") {
      console.log(`Usage:
  npx tsx scripts/eval-markov.ts [options] <buddy-dir>

  buddy-dir   Path to a buddy instance (required)

Options:
  --questions, -q <file>   Path to questions JSON (default: <buddy-dir>/eval-questions.json)
  --dry-run                Show questions and context stats without calling the model
  --verbose, -v            Show event types and answer previews for each question
  --help                   Show this help`);
      process.exit(0);
    } else {
      console.error(`Unknown flag: ${args[0]}`);
      process.exit(1);
    }
  }

  if (args.length === 0) {
    console.error("Missing required argument: <buddy-dir>");
    console.error("Usage: npx tsx scripts/eval-markov.ts [options] <buddy-dir>");
    process.exit(1);
  }

  const buddyDir = resolve(args[0]!);

  if (!existsSync(buddyDir)) {
    console.error(`Directory not found: ${buddyDir}`);
    process.exit(1);
  }

  const questionsPath = questionsOverride
    ? resolve(questionsOverride)
    : join(buddyDir, "eval-questions.json");

  return { dryRun, verbose, buddyDir, questionsPath };
}

async function main(): Promise<void> {
  const { dryRun, verbose, buddyDir, questionsPath } = parseArgs(process.argv.slice(2));

  const questions = loadQuestions(questionsPath);

  console.log(`Buddy directory: ${buddyDir}`);
  console.log(`Questions file: ${questionsPath}`);
  console.log(`Questions: ${questions.length}`);

  const memoryCtx = buildMemoryContext(buddyDir);
  const fullCtx = buildFullContext(buddyDir);

  console.log(`Memory context: ${memoryCtx.length} chars`);
  console.log(`Full context: ${fullCtx.length} chars`);

  if (dryRun) {
    console.log("\n--- Dry run: question list ---\n");
    for (const q of questions) {
      console.log(`[${q.id}] (${q.domain}) ${q.question}`);
      console.log(`  Expected keywords: ${q.expectedKeywords.join(", ")}`);
    }
    console.log("\nDry run complete. No model calls made.");
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

  const modelRuntime = await createBuddyModelRuntime();

  // Read the configured provider/model from ~/.buddy/config.json — the same
  // source the app uses. Without this, Pi SDK picks its own default (e.g.
  // claude-opus) regardless of what the user configured in Settings.
  const appConfig = readStateFile<SetupConfig>(globalConfigPath());
  if (!appConfig?.provider || !appConfig?.model) {
    console.error("Could not read provider/model from config. Run Buddy setup first.");
    process.exit(1);
  }
  const sessionModel = await resolveSessionModel(modelRuntime, appConfig.provider, appConfig.model);
  console.log(`Model: ${appConfig.provider}/${appConfig.model}`);

  // Session scratch directory — kept separate from the buddy instance being
  // evaluated to avoid polluting it with .pi/ session files.
  const scriptDir = new URL(".", import.meta.url).pathname;
  const sessionDir = resolve(scriptDir, "..", "fixtures", "consolidation-test");

  const results: EvalResult[] = [];

  for (const q of questions) {
    process.stdout.write(`[${q.id}] ${q.question.slice(0, 60)}... `);

    const memoryAnswer = await askModel(modelRuntime, sessionModel, memoryCtx, q.question, sessionDir, verbose);
    const memoryCheck = checkKeywords(memoryAnswer, q.expectedKeywords);

    const fullAnswer = await askModel(modelRuntime, sessionModel, fullCtx, q.question, sessionDir, verbose);
    const fullCheck = checkKeywords(fullAnswer, q.expectedKeywords);

    let error: string | undefined;
    if (!memoryAnswer && !fullAnswer) {
      error = "both answers empty — text extraction broken (check --verbose for event types)";
    } else if (!memoryAnswer) {
      error = "memory-round answer empty — partial extraction failure";
    } else if (!fullAnswer) {
      error = "full-context answer empty — partial extraction failure";
    }

    const gap = !error &&
      memoryCheck.misses.length > 0 &&
      fullCheck.misses.length < memoryCheck.misses.length;

    results.push({
      questionId: q.id,
      question: q.question,
      domain: q.domain,
      memoryAnswer,
      fullAnswer,
      memoryHits: memoryCheck.hits,
      memoryMisses: memoryCheck.misses,
      fullHits: fullCheck.hits,
      fullMisses: fullCheck.misses,
      gap,
      error,
    });

    if (error) {
      console.log("ERROR");
    } else {
      console.log(gap ? "GAP" : "OK");
    }
  }

  printReport(results);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
