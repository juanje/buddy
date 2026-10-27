#!/usr/bin/env node
/**
 * The progress record: what is built, written only by a check that verified it
 * (NFR-TEST-03).
 *
 *   npm run progress -- status
 *   npm run progress -- show FR-xxx
 *   npm run progress -- check FR-xxx
 *
 * `check` reads the FR's commits and runs its tests at them: the contract's
 * scenarios must fail first before the code, each test commit's tests must
 * fail first at that commit and pass now, and the quality gate must pass now.
 * Only then is the FR written to the record, as built at HEAD.
 */

import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative } from "node:path";
import { pathToFileURL } from "node:url";

export const PROGRESS_RECORD_PATH = "specs/progress.json";

const FEATURES_DIR = "specs/features/";
const STEPS_DIR = "tests/steps/";
const PRODUCTION_DIRS = ["backends/", "src/", "shared/"];
const UNIT_TEST_FILE = /\.test\.[cm]?[jt]sx?$/;

/** The quality gate, as AGENTS.md lists it. */
const QUALITY_GATE: Array<[string, string[]]> = [
  ["npx", ["tsc", "--noEmit"]],
  ["npx", ["vite", "build"]],
  ["npm", ["test"]],
];

const MAX_FAILING_LINES = 40;

const HELP = `The progress record: what is built, written only by a check that verified it (NFR-TEST-03).

  npm run progress -- status          every FR with a contract or a record, and its state
  npm run progress -- show FR-xxx     one FR: its state and its contract, test and code commits
  npm run progress -- check FR-xxx    verify FR-xxx's commits and the quality gate; record it as built
`;

// ── The record ──────────────────────────────────────────────────────

export interface ProgressRecord {
  /** FRs a check verified: the commit it verified and the day it did. */
  built: Record<string, { commit: string; date: string }>;
  /** FRs marked built before the check existed, shown as such until checked. */
  recordedBeforeChecks: string[];
}

export function readProgressRecord(root: string): ProgressRecord {
  const path = join(root, PROGRESS_RECORD_PATH);
  if (!existsSync(path)) return { built: {}, recordedBeforeChecks: [] };
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<ProgressRecord>;
  return { built: parsed.built ?? {}, recordedBeforeChecks: parsed.recordedBeforeChecks ?? [] };
}

export function writeProgressRecord(root: string, record: ProgressRecord): void {
  const path = join(root, PROGRESS_RECORD_PATH);
  const sorted: ProgressRecord = {
    built: Object.fromEntries(Object.entries(record.built).sort(([a], [b]) => a.localeCompare(b))),
    recordedBeforeChecks: [...record.recordedBeforeChecks].sort(),
  };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
}

// ── Commits ─────────────────────────────────────────────────────────

export interface Commit {
  sha: string;
  subject: string;
  message: string;
  files: string[];
}

export type CommitRole = "contract" | "test" | "code";

const ROLE_BY_TYPE: Record<string, CommitRole> = {
  spec: "contract",
  test: "test",
  feat: "code",
  fix: "code",
};

const COMMIT_TYPE = /^(\w+)(?:\([^)]*\))?!?:/;
const FR_ID = /^N?FR-[A-Z]+(?:-[A-Z]+)*-\d+[a-z]?$/;
const FR_IDS_IN_TEXT = /(?<![A-Za-z0-9-])N?FR-[A-Z]+(?:-[A-Z]+)*-\d+[a-z]?(?![A-Za-z0-9])/g;

export function isFrId(value: string): boolean {
  return FR_ID.test(value);
}

function mentions(text: string, frId: string): boolean {
  const escaped = frId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![A-Za-z0-9-])${escaped}(?![A-Za-z0-9])`).test(text);
}

/** The role a commit plays for an FR: its type, when its subject names the FR. */
export function commitRole(subject: string, frId: string): CommitRole | undefined {
  const type = COMMIT_TYPE.exec(subject)?.[1];
  const role = type ? ROLE_BY_TYPE[type] : undefined;
  return role && mentions(subject, frId) ? role : undefined;
}

/** What a commit proves by mutant: one `Mutant: <name> — <what was broken>` trailer per test or scenario. */
export function mutantTrailers(message: string): Set<string> {
  const names = new Set<string>();
  for (const line of message.split("\n")) {
    const trailer = /^Mutant:\s*(\S.*?)\s+—\s+\S/.exec(line);
    if (trailer) names.add(trailer[1]);
  }
  return names;
}

/** Whether a commit's trailers prove a scenario key: by its own key or, for a row, by its outline. */
function proves(trailers: Set<string>, key: string): boolean {
  return trailers.has(key) || trailers.has(scenarioName(key));
}

const mutantClause = (name: string) =>
  `when no Red is possible, prove it by a mutant and add the trailer line \`Mutant: ${name} — <what you broke>\` to the test(…) commit message.`;

export function passedBeforeCodeRemedy(name: string): string {
  return `write the test before the code it tests, so it fails first at its commit; ${mutantClause(name)}`;
}

function touchesSteps(commit: Commit): boolean {
  return commit.files.some((f) => f.startsWith(STEPS_DIR));
}

// ── Scenarios and tests, and how they ran ───────────────────────────

/** An example row's key: its outline's name and its cells, so each row is a scenario of its own. */
function rowKey(outline: string, cells: string[]): string {
  return [outline, ...cells].join(" | ");
}

/** The scenario or outline a key from scenariosTagged or scenarioOutcomes belongs to. */
export function scenarioName(key: string): string {
  return key.split(" | ")[0];
}

/**
 * Keys of the scenarios tagged with the FR, or under a feature tagged with it:
 * a scenario's name, or for an outline one key per example row.
 */
export function scenariosTagged(feature: string, frId: string): string[] {
  const tag = `@${frId}`;
  const keys: string[] = [];
  let pending: string[] = [];
  let featureTags: string[] = [];
  /** The tagged outline whose Examples rows are being read. */
  let outline: string | undefined;
  let headerNext = false;
  for (const raw of feature.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    if (line.startsWith("@")) {
      pending.push(...line.split(/\s+/));
      continue;
    }
    if (line.startsWith("Feature:")) {
      featureTags = pending;
    } else if (/^(?:Examples|Scenarios):/.test(line)) {
      headerNext = outline !== undefined;
    } else if (line.startsWith("|")) {
      if (headerNext) {
        headerNext = false;
      } else if (outline !== undefined) {
        keys.push(rowKey(outline, line.slice(1, -1).split("|").map((cell) => cell.trim())));
      }
    } else {
      const scenario = /^(Scenario Outline|Scenario Template|Scenario|Example):\s*(.*)$/.exec(line);
      if (scenario) {
        const tagged = [...featureTags, ...pending].includes(tag);
        const isOutline = scenario[1] === "Scenario Outline" || scenario[1] === "Scenario Template";
        outline = tagged && isOutline ? scenario[2].trim() : undefined;
        if (tagged && !isOutline) keys.push(scenario[2].trim());
      }
    }
    pending = [];
  }
  return keys;
}

export type RunOutcome = "fails first" | "passed" | "never ran" | "did not fail first";

export interface Outcome {
  outcome: RunOutcome;
  detail: string;
}

/** Worst first: of two pickles with the same key, the worse one decides. */
const OUTCOME_RANK: Record<RunOutcome, number> = {
  "never ran": 0,
  "did not fail first": 0,
  passed: 1,
  "fails first": 2,
};

function firstLine(text: string): string {
  return text.split("\n").map((l) => l.trim()).find((l) => l !== "") ?? "";
}

function stepOutcome(status: string | undefined, message: string | undefined): Outcome {
  if (status === undefined) return { outcome: "passed", detail: "every step passed" };
  if (status === "FAILED") return { outcome: "fails first", detail: firstLine(message ?? "") };
  return { outcome: "never ran", detail: `a step was ${status.toLowerCase()}` };
}

/** Each scenario's outcome, by its key (see scenariosTagged), from a cucumber message stream. */
export function scenarioOutcomes(ndjson: string): Map<string, Outcome> {
  const scenarioNames = new Map<string, string>();
  const rowCells = new Map<string, string[]>();
  const pickleScenario = new Map<string, string>();
  const caseScenario = new Map<string, string>();
  const startedScenario = new Map<string, string>();
  const firstNotPassed = new Map<string, { status: string; message?: string }>();

  for (const line of ndjson.split("\n")) {
    if (line.trim() === "") continue;
    const envelope = JSON.parse(line);
    if (envelope.gherkinDocument) {
      const children = envelope.gherkinDocument.feature?.children ?? [];
      for (const child of children) {
        const scenarios = child.rule ? child.rule.children.map((c: { scenario?: unknown }) => c.scenario) : [child.scenario];
        for (const scenario of scenarios) {
          if (!scenario) continue;
          scenarioNames.set(scenario.id, scenario.name);
          for (const examples of scenario.examples ?? []) {
            for (const row of examples.tableBody ?? []) {
              rowCells.set(row.id, row.cells.map((cell: { value: string }) => cell.value));
            }
          }
        }
      }
    } else if (envelope.pickle) {
      const { id, name, astNodeIds } = envelope.pickle;
      const scenario = scenarioNames.get(astNodeIds?.[0]) ?? name;
      const cells = rowCells.get(astNodeIds?.[1]);
      pickleScenario.set(id, cells ? rowKey(scenario, cells) : scenario);
    } else if (envelope.testCase) {
      caseScenario.set(envelope.testCase.id, pickleScenario.get(envelope.testCase.pickleId) ?? "");
    } else if (envelope.testCaseStarted) {
      const { id, testCaseId } = envelope.testCaseStarted;
      startedScenario.set(id, caseScenario.get(testCaseId) ?? "");
    } else if (envelope.testStepFinished) {
      const { testCaseStartedId, testStepResult } = envelope.testStepFinished;
      if (testStepResult.status !== "PASSED" && !firstNotPassed.has(testCaseStartedId)) {
        firstNotPassed.set(testCaseStartedId, testStepResult);
      }
    }
  }

  const outcomes = new Map<string, Outcome>();
  for (const [started, name] of startedScenario) {
    const result = firstNotPassed.get(started);
    const outcome = stepOutcome(result?.status, result?.message);
    const known = outcomes.get(name);
    if (!known || OUTCOME_RANK[outcome.outcome] < OUTCOME_RANK[known.outcome]) outcomes.set(name, outcome);
  }
  return outcomes;
}

function isProjectModule(specifier: string): boolean {
  return (specifier.startsWith(".") || specifier.startsWith("/")) && !specifier.includes("/node_modules/");
}

/**
 * Why a test file, or the whole BDD suite, failed to load. A project module or
 * export that does not exist yet is the missing code; anything else is not.
 */
export function loadFailure(output: string): Outcome {
  const missingModule = /Cannot find module '([^']+)'/.exec(output);
  if (missingModule && isProjectModule(missingModule[1])) {
    return { outcome: "fails first", detail: `the module ${missingModule[1]} does not exist yet` };
  }
  const missingExport = /The requested module '([^']+)' does not provide an export named '([^']+)'/.exec(output);
  if (missingExport && isProjectModule(missingExport[1])) {
    return { outcome: "fails first", detail: `${missingExport[1]} does not export ${missingExport[2]} yet` };
  }
  const reason =
    output.split("\n").map((l) => l.trim()).find((l) => /Error|Cannot find/.test(l)) ?? firstLine(output);
  return { outcome: "did not fail first", detail: `it failed to load: ${reason || "no output"}` };
}

export interface UnitTestOutcome extends Outcome {
  /** The test's own title, without its describe titles, as written in its file. */
  title: string;
}

export interface UnitFileOutcome {
  /** Set when the file failed to load and none of its tests ran. */
  load?: Outcome;
  /** By full name: the describe titles and the test title. */
  tests: Map<string, UnitTestOutcome>;
}

/** Each test's outcome, by file relative to `root`, from a vitest JSON report. */
export function unitOutcomes(json: string, root: string): Map<string, UnitFileOutcome> {
  const report = JSON.parse(json) as {
    testResults: Array<{
      name: string;
      status: string;
      message?: string;
      assertionResults: Array<{ fullName: string; title?: string; status: string; failureMessages: string[] }>;
    }>;
  };
  const files = new Map<string, UnitFileOutcome>();
  for (const file of report.testResults) {
    const path = isAbsolute(file.name) ? relative(root, file.name) : file.name;
    if (file.assertionResults.length === 0 && file.status === "failed") {
      files.set(path, { load: loadFailure(file.message ?? ""), tests: new Map() });
      continue;
    }
    const tests = new Map<string, UnitTestOutcome>();
    for (const test of file.assertionResults) {
      const title = test.title ?? test.fullName;
      if (test.status === "passed") {
        tests.set(test.fullName, { outcome: "passed", detail: "it passed", title });
      } else if (test.status === "failed") {
        tests.set(test.fullName, { outcome: "fails first", detail: firstLine(test.failureMessages[0] ?? ""), title });
      } else {
        tests.set(test.fullName, { outcome: "never ran", detail: `it was ${test.status}`, title });
      }
    }
    files.set(path, { tests });
  }
  return files;
}

/**
 * The commit that removed a test after it last existed, given a file's
 * content at the commit that added the test and at each later commit that
 * changed the file (null where it was deleted). Undefined while it still
 * exists in the last state. Without a title it follows the file itself.
 */
export function removedBy(
  states: Array<{ sha: string; content: string | null }>,
  title: string | undefined,
): string | undefined {
  const exists = (content: string | null) =>
    content !== null &&
    (title === undefined || ['"', "'", "`"].some((quote) => content.includes(`${quote}${title}${quote}`)));
  let last = -1;
  states.forEach((state, i) => {
    if (exists(state.content)) last = i;
  });
  return last >= 0 && last < states.length - 1 ? states[last + 1].sha : undefined;
}

// ── Problems ────────────────────────────────────────────────────────

export interface Problem {
  /** The commit the problem is in, when there is one. */
  commit?: Commit;
  what: string;
  detail?: string;
  remedy: string;
}

/** What the FR's commits show without running anything: contract, tests, order. */
export function structuralProblems(commits: Commit[], frId: string): Problem[] {
  const roles = commits.map((c) => commitRole(c.subject, frId));
  const contracts = commits.filter((_, i) => roles[i] === "contract");
  if (contracts.length === 0) {
    return [
      {
        what: `${frId} has no contract commit`,
        remedy: `ask the person for its approved contract, committed as spec(…): ${frId}.`,
      },
    ];
  }
  const firstTest = roles.indexOf("test");
  if (firstTest < 0) {
    return [
      {
        commit: contracts.at(-1),
        what: "there is no test commit",
        detail: `no test(…): ${frId} commit follows the contract`,
        remedy: `commit the step definitions and unit tests alone as test(…): ${frId}, failing first, before the code.`,
      },
    ];
  }
  const problems: Problem[] = [];
  commits.forEach((commit, i) => {
    if (roles[i] === "code" && i < firstTest) {
      problems.push({
        commit,
        what: "the code came before its test",
        detail: `it comes before the first test(…): ${frId} commit`,
        remedy: `while the commits are not shared, reorder them so a failing test(…): ${frId} commit comes before this one; once they are, ask the person how to record ${frId}.`,
      });
    }
    if (roles[i] === "test") {
      const production = commit.files.filter((f) => PRODUCTION_DIRS.some((dir) => f.startsWith(dir)));
      if (production.length > 0) {
        problems.push({
          commit,
          what: "the test commit changes production code",
          detail: production.join(", "),
          remedy: "move the production change into the feat(…) or fix(…) commit that makes the test pass.",
        });
      }
    }
  });
  return problems;
}

export function formatProblems(frId: string, problems: Problem[]): string {
  const lines = [`The check of ${frId} failed; nothing was recorded.`, ""];
  for (const problem of problems) {
    const [first, ...rest] = (problem.detail ?? "").split("\n");
    if (problem.commit) lines.push(`- ${problem.commit.sha.slice(0, 7)} ${problem.commit.subject}`);
    lines.push(`${problem.commit ? "  " : "- "}${problem.what}${first ? `: ${first}` : ""}`);
    for (const line of rest) lines.push(`      ${line}`);
    lines.push(`  To make it hold: ${problem.remedy}`, "");
  }
  return `${lines.join("\n")}\n`;
}

/** The lines of a failed gate command that say what failed, without stack frames. */
export function failingLines(output: string): string[] {
  const lines = output.replace(/\x1b\[[0-9;]*m/g, "").split("\n").filter((l) => !/^\s+at /.test(l));
  const cap = (block: string[]) => block.slice(0, MAX_FAILING_LINES);

  const cucumber = lines.findIndex((l) => l.trim() === "Failures:");
  if (cucumber >= 0) {
    const summary = lines.findIndex((l, i) => i > cucumber && /^\d+ scenarios? \(/.test(l.trim()));
    return cap(lines.slice(cucumber + 1, summary >= 0 ? summary + 2 : undefined));
  }
  const vitest = lines.findIndex((l) => /Failed Tests \d+/.test(l));
  if (vitest >= 0) {
    const summary = lines.findIndex((l, i) => i > vitest && /Test Files /.test(l));
    return cap(lines.slice(vitest, summary >= 0 ? summary + 1 : undefined));
  }
  const tsc = lines.filter((l) => /error TS\d+/.test(l));
  if (tsc.length > 0) return cap(tsc);
  return lines.filter((l) => l.trim() !== "").slice(-MAX_FAILING_LINES);
}

// ── States ──────────────────────────────────────────────────────────

export type FrState =
  | { state: "in progress" }
  | { state: "built" | "changed"; commit: string; date: string }
  | { state: "recorded before the checks" };

/**
 * Every FR with a record or a contract commit, and its state. Contract
 * commits count from `start`, the commit that started the record; earlier
 * ones are history. Before the record starts, every contract commit counts.
 */
export function frStates(record: ProgressRecord, commits: Commit[], start?: string): Map<string, FrState> {
  const ids = new Set<string>([...Object.keys(record.built), ...record.recordedBeforeChecks]);
  const from = Math.max(0, commits.findIndex((c) => c.sha === start));
  for (const commit of commits.slice(from)) {
    if (COMMIT_TYPE.exec(commit.subject)?.[1] !== "spec") continue;
    for (const id of commit.subject.match(FR_IDS_IN_TEXT) ?? []) ids.add(id);
  }
  const states = new Map<string, FrState>();
  for (const id of [...ids].sort()) {
    const built = record.built[id];
    if (built) {
      const verified = commits.findIndex((c) => c.sha === built.commit);
      const changed = commits.some((c, i) => i > verified && commitRole(c.subject, id) === "contract");
      states.set(id, { state: changed ? "changed" : "built", commit: built.commit, date: built.date });
    } else if (record.recordedBeforeChecks.includes(id)) {
      states.set(id, { state: "recorded before the checks" });
    } else {
      states.set(id, { state: "in progress" });
    }
  }
  return states;
}

export function formatState(id: string, state: FrState): string {
  switch (state.state) {
    case "in progress":
      return `${id}  in progress`;
    case "built":
      return `${id}  built at ${state.commit.slice(0, 7)} on ${state.date}`;
    case "changed":
      return `${id}  changed since its verification at ${state.commit.slice(0, 7)} on ${state.date}`;
    case "recorded before the checks":
      return `${id}  built, recorded before the checks`;
  }
}

// ── Running things ──────────────────────────────────────────────────

export interface CommandResult {
  code: number;
  /** stdout and stderr, interleaved. */
  output: string;
}

export type CommandRunner = (
  command: string,
  args: string[],
  options: { cwd: string },
) => Promise<CommandResult>;

export const runCommand: CommandRunner = (command, args, { cwd }) =>
  new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    child.on("error", (error) => resolve({ code: 127, output: `${output}${error.message}` }));
    child.on("close", (code) => resolve({ code: code ?? 1, output }));
  });

class ProgressError extends Error {}

interface Context {
  root: string;
  run: CommandRunner;
  out: (text: string) => void;
  err: (text: string) => void;
  now: () => Date;
}

async function git(ctx: Context, args: string[]): Promise<string> {
  const result = await ctx.run("git", args, { cwd: ctx.root });
  if (result.code !== 0) throw new ProgressError(`git ${args[0]} failed:\n${result.output}`);
  return result.output;
}

/** File content at a commit, or "" when the file or the commit does not exist. */
async function fileAt(ctx: Context, sha: string, path: string): Promise<string> {
  const result = await ctx.run("git", ["show", `${sha}:${path}`], { cwd: ctx.root });
  return result.code === 0 ? result.output : "";
}

async function readCommits(ctx: Context, withFiles: boolean): Promise<Commit[]> {
  const args = ["log", "--reverse", "--topo-order", "--format=%x1e%H%x1f%B%x1f"];
  // Without renames, a moved file shows as deleted at its old path, so a test there is followed to its move.
  if (withFiles) args.push("--name-only", "--no-renames");
  const raw = await git(ctx, [...args, "HEAD"]);
  return raw
    .split("\x1e")
    .slice(1)
    .map((entry) => {
      const [sha, body, names] = entry.split("\x1f");
      const message = body.trim();
      return {
        sha,
        subject: message.split("\n")[0],
        message,
        files: (names ?? "").split("\n").map((f) => f.trim()).filter((f) => f !== ""),
      };
    });
}

/** Detached worktrees at past commits, sharing the project's node_modules. */
class Checkouts {
  private readonly base: string;
  private readonly dirs = new Map<string, string>();
  private files = 0;

  constructor(
    private readonly ctx: Context,
    private readonly head: string,
  ) {
    this.base = realpathSync(mkdtempSync(join(tmpdir(), "buddy-progress-")));
  }

  /** A scratch file path for a runner's report. */
  reportPath(extension: string): string {
    this.files += 1;
    return join(this.base, `report-${this.files}.${extension}`);
  }

  async at(sha: string): Promise<string> {
    if (sha === this.head) return this.ctx.root;
    const known = this.dirs.get(sha);
    if (known) return known;
    const dir = join(this.base, sha.slice(0, 12));
    await git(this.ctx, ["worktree", "add", "--detach", dir, sha]);
    const modules = join(this.ctx.root, "node_modules");
    if (existsSync(modules)) symlinkSync(realpathSync(modules), join(dir, "node_modules"));
    this.dirs.set(sha, dir);
    return dir;
  }

  async removeAll(): Promise<void> {
    for (const dir of this.dirs.values()) {
      await this.ctx.run("git", ["worktree", "remove", "--force", dir], { cwd: this.ctx.root });
    }
    await this.ctx.run("git", ["worktree", "prune"], { cwd: this.ctx.root });
    rmSync(this.base, { recursive: true, force: true });
  }
}

interface ScenarioRun {
  /** Set when the BDD suite failed to load and no scenario ran. */
  load?: Outcome;
  outcomes: Map<string, Outcome>;
}

async function runScenarios(ctx: Context, checkouts: Checkouts, sha: string, frId: string): Promise<ScenarioRun> {
  const cwd = await checkouts.at(sha);
  const report = checkouts.reportPath("ndjson");
  ctx.err(`Running the ${frId} scenarios at ${sha.slice(0, 7)}…\n`);
  const result = await ctx.run(
    "npm",
    ["run", "test:bdd", "--", "--tags", `@${frId}`, "--format", `message:${report}`],
    { cwd },
  );
  const messages = existsSync(report) ? readFileSync(report, "utf8") : "";
  const outcomes = messages.trim() === "" ? new Map<string, Outcome>() : scenarioOutcomes(messages);
  if (outcomes.size === 0 && result.code !== 0) return { load: loadFailure(result.output), outcomes };
  return { outcomes };
}

async function runUnitTests(
  ctx: Context,
  checkouts: Checkouts,
  sha: string,
  files: string[],
): Promise<Map<string, UnitFileOutcome>> {
  const cwd = await checkouts.at(sha);
  const report = checkouts.reportPath("json");
  ctx.err(`Running ${files.join(", ")} at ${sha.slice(0, 7)}…\n`);
  const result = await ctx.run(
    "npm",
    ["run", "test:unit", "--", ...files, "--reporter=json", `--outputFile=${report}`],
    { cwd },
  );
  if (!existsSync(report)) {
    const load = loadFailure(result.output);
    return new Map(files.map((file) => [file, { load, tests: new Map() }]));
  }
  // vitest reports real paths; a root under a symlink (macOS /var) would match none.
  return unitOutcomes(readFileSync(report, "utf8"), realpathSync(cwd));
}

/** Each scenario a contract commit added must fail first before the code that follows it. */
async function contractProblems(
  ctx: Context,
  checkouts: Checkouts,
  commits: Commit[],
  frId: string,
): Promise<Problem[]> {
  const roleAt = (i: number) => commitRole(commits[i].subject, frId);
  const byTarget = new Map<number, { names: string[]; noCode: boolean }>();

  for (let i = 0; i < commits.length; i++) {
    if (roleAt(i) !== "contract") continue;
    const contract = commits[i];
    const added: string[] = [];
    for (const path of contract.files.filter((f) => f.startsWith(FEATURES_DIR) && f.endsWith(".feature"))) {
      const before = new Set(scenariosTagged(await fileAt(ctx, `${contract.sha}^`, path), frId));
      for (const name of scenariosTagged(await fileAt(ctx, contract.sha, path), frId)) {
        if (!before.has(name)) added.push(name);
      }
    }
    if (added.length === 0) continue;
    const code = commits.findIndex((_, j) => j > i && roleAt(j) === "code");
    const target = code >= 0 ? code - 1 : commits.length - 1;
    const group = byTarget.get(target) ?? { names: [], noCode: code < 0 };
    group.names.push(...added);
    byTarget.set(target, group);
  }

  const problems: Problem[] = [];
  for (const [target, { names, noCode }] of byTarget) {
    const provedByMutant = new Set(
      commits.flatMap((c, j) => (j <= target && roleAt(j) === "test" ? [...mutantTrailers(c.message)] : [])),
    );
    const commit = commits[target];
    const where = noCode
      ? `no feat(…) or fix(…): ${frId} commit follows its contract, and at HEAD`
      : `at the commit before the first feat(…) or fix(…): ${frId} commit`;
    const run = await runScenarios(ctx, checkouts, commit.sha, frId);
    for (const name of names) {
      const outcome = run.load ?? run.outcomes.get(name) ?? { outcome: "never ran", detail: "it was not found" };
      if (outcome.outcome === "passed" && !proves(provedByMutant, name)) {
        problems.push({
          commit,
          what: "the scenario passed before its code",
          detail: `"${name}" passed ${where}`,
          remedy: `commit its step definitions before the code they test, so it fails first; ${mutantClause(name)}`,
        });
      } else if (outcome.outcome === "never ran") {
        problems.push({
          commit,
          what: "the scenario never ran before its code",
          detail: `"${name}" ${where}: ${outcome.detail}`,
          remedy: `commit its step definitions as test(…): ${frId} before the code, so it runs and fails first.`,
        });
      } else if (outcome.outcome === "did not fail first") {
        problems.push({
          commit,
          what: "the scenario did not fail first",
          detail: `"${name}" ${where}: the BDD suite ${outcome.detail}`,
          remedy: "make the suite load at that commit, so the scenario runs and fails on the missing code.",
        });
      }
    }
  }
  return problems;
}

/** A unit test a test commit counted as failing first, to be seen passing now. */
interface Counted {
  commit: Commit;
  file: string;
  /** Undefined when the whole file failed to load at the commit. */
  name?: string;
  title?: string;
}

/** A scenario a test commit's steps made fail first, to be seen passing later. */
interface CountedScenario {
  commit: Commit;
  key: string;
}

/** Each test commit's tests and steps must fail first at it and pass now. */
async function testCommitProblems(
  ctx: Context,
  checkouts: Checkouts,
  commits: Commit[],
  frId: string,
  head: string,
): Promise<Problem[]> {
  const problems: Problem[] = [];
  const counted: Counted[] = [];
  const countedScenarios: CountedScenario[] = [];

  for (const commit of commits.filter((c) => commitRole(c.subject, frId) === "test")) {
    const unitFiles = commit.files.filter((f) => UNIT_TEST_FILE.test(f));
    if (unitFiles.length === 0 && !touchesSteps(commit)) {
      problems.push({
        commit,
        what: "the test commit adds no test or step",
        detail: `it changes ${commit.files.join(", ") || "no file"}`,
        remedy: `commit tests and step definitions as test(…): ${frId}; their helpers go with them.`,
      });
      continue;
    }
    const provedByMutant = mutantTrailers(commit.message);
    const cwd = await checkouts.at(commit.sha);

    const present = unitFiles.filter((f) => existsSync(join(cwd, f)));
    if (present.length > 0) {
      const atCommit = await runUnitTests(ctx, checkouts, commit.sha, present);
      const existedBefore: string[] = [];
      for (const file of present) {
        const exists = await ctx.run("git", ["cat-file", "-e", `${commit.sha}^:${file}`], { cwd: ctx.root });
        if (exists.code === 0) existedBefore.push(file);
      }
      const before =
        existedBefore.length > 0
          ? await runUnitTests(ctx, checkouts, await revParse(ctx, `${commit.sha}^`), existedBefore)
          : new Map<string, UnitFileOutcome>();

      let failedFirst = false;
      for (const file of present) {
        const result = atCommit.get(file) ?? {
          load: { outcome: "never ran" as const, detail: "vitest did not run it" },
          tests: new Map<string, UnitTestOutcome>(),
        };
        if (result.load) {
          if (result.load.outcome === "fails first") {
            failedFirst = true;
            counted.push({ commit, file });
          } else {
            problems.push({
              commit,
              what: "the test did not fail first",
              detail: `${file} ${result.load.detail}`,
              remedy: "make it load and fail on an assertion or on the missing code.",
            });
          }
          continue;
        }
        const known = before.get(file)?.tests ?? new Map<string, Outcome>();
        for (const [name, outcome] of result.tests) {
          if (outcome.outcome === "fails first" || (outcome.outcome === "passed" && provedByMutant.has(name))) {
            failedFirst = true;
            counted.push({ commit, file, name, title: outcome.title });
          } else if (!known.has(name) && outcome.outcome === "passed") {
            problems.push({
              commit,
              what: "the test passed before its code",
              detail: `"${name}" in ${file} passed at this commit`,
              remedy: passedBeforeCodeRemedy(name),
            });
          } else if (!known.has(name)) {
            problems.push({
              commit,
              what: "the test did not fail first",
              detail: `"${name}" in ${file}: ${outcome.detail}`,
              remedy: "make it run and fail on an assertion or on the missing code.",
            });
          }
        }
      }
      if (!failedFirst && !problems.some((p) => p.commit === commit)) {
        problems.push({
          commit,
          what: "the test passed before its code",
          detail: `no test in ${present.join(", ")} failed at this commit`,
          remedy: passedBeforeCodeRemedy("<test name>"),
        });
      }
    }

    if (touchesSteps(commit)) {
      const run = await runScenarios(ctx, checkouts, commit.sha, frId);
      if (run.load) {
        if (run.load.outcome !== "fails first") {
          problems.push({
            commit,
            what: "the test did not fail first",
            detail: `the BDD suite ${run.load.detail}`,
            remedy: "make the suite load at this commit, so its scenarios run and fail on the missing code.",
          });
        }
      } else {
        for (const [key, o] of run.outcomes) {
          if (o.outcome === "fails first" || (o.outcome === "passed" && proves(provedByMutant, key))) {
            countedScenarios.push({ commit, key });
          }
        }
      }
      if (!run.load && !countedScenarios.some((c) => c.commit === commit)) {
        const passed = [...run.outcomes.values()].some((o) => o.outcome === "passed");
        const results = [...run.outcomes].map(([name, o]) => `"${name}": ${o.detail}`).join("; ");
        problems.push({
          commit,
          what: passed ? "the test passed before its code" : "the test did not fail first",
          detail: `no ${frId} scenario failed first at this commit (${results || "none ran"})`,
          remedy: passedBeforeCodeRemedy("<scenario name>"),
        });
      }
    }
  }

  problems.push(...(await unitTestsPassLater(ctx, checkouts, commits, counted, head)));
  problems.push(...(await scenariosPassLater(ctx, checkouts, commits, countedScenarios, frId)));
  return problems;
}

/** File content at a commit, or null where the file does not exist. */
async function fileOrNull(ctx: Context, sha: string, path: string): Promise<string | null> {
  const result = await ctx.run("git", ["show", `${sha}:${path}`], { cwd: ctx.root });
  return result.code === 0 ? result.output : null;
}

/** The last commit where a test (or, without a title, its file) still exists: HEAD, or just before what removed it. */
async function lastCommitWithTest(
  ctx: Context,
  commits: Commit[],
  { commit, file, title }: Counted,
  head: string,
): Promise<string> {
  const later = commits.slice(commits.indexOf(commit) + 1).filter((c) => c.files.includes(file));
  const states = [{ sha: commit.sha, content: await fileOrNull(ctx, commit.sha, file) }];
  for (const c of later) states.push({ sha: c.sha, content: await fileOrNull(ctx, c.sha, file) });
  const removing = removedBy(states, title);
  return removing ? revParse(ctx, `${removing}^`) : head;
}

const PASS_LATER_REMEDY =
  "make it pass once its code exists: a test that fails first counts only when its code then makes it pass.";

/** Each unit test counted as failing first must pass at the last commit where it still exists. */
async function unitTestsPassLater(
  ctx: Context,
  checkouts: Checkouts,
  commits: Commit[],
  counted: Counted[],
  head: string,
): Promise<Problem[]> {
  const byLast = new Map<string, Counted[]>();
  for (const test of counted) {
    const last = await lastCommitWithTest(ctx, commits, test, head);
    byLast.set(last, [...(byLast.get(last) ?? []), test]);
  }
  const problems: Problem[] = [];
  for (const [last, tests] of byLast) {
    const files = [...new Set(tests.map((t) => t.file))];
    const results = await runUnitTests(ctx, checkouts, last, files);
    for (const { commit, file, name } of tests) {
      const result = results.get(file);
      const all = result ? [...result.tests.values()] : [];
      const passing = name
        ? result?.tests.get(name)?.outcome === "passed"
        : all.length > 0 && all.every((o) => o.outcome === "passed");
      if (!passing) {
        problems.push({
          commit,
          what: "the test does not pass where it last exists",
          detail: `${name ? `"${name}" in ${file}` : file} at ${last.slice(0, 7)}${last === head ? " (HEAD)" : ""}`,
          remedy: PASS_LATER_REMEDY,
        });
      }
    }
  }
  return problems;
}

/** Keys of the FR's scenarios at a commit, across every feature file. */
async function scenarioKeysAt(ctx: Context, sha: string, frId: string): Promise<string[]> {
  const listing = await git(ctx, ["ls-tree", "-r", "--name-only", sha, "--", FEATURES_DIR]);
  const keys: string[] = [];
  for (const path of listing.split("\n").filter((f) => f.endsWith(".feature"))) {
    keys.push(...scenariosTagged(await fileAt(ctx, sha, path), frId));
  }
  return keys;
}

/**
 * Each scenario a test commit's steps made fail first must pass at the last
 * commit where it still exists. One still there at HEAD is the gate's to run.
 */
async function scenariosPassLater(
  ctx: Context,
  checkouts: Checkouts,
  commits: Commit[],
  counted: CountedScenario[],
  frId: string,
): Promise<Problem[]> {
  const keysAt = new Map<string, string>();
  const quotedKeys = async (sha: string) => {
    if (!keysAt.has(sha)) keysAt.set(sha, (await scenarioKeysAt(ctx, sha, frId)).map((k) => `"${k}"`).join("\n"));
    return keysAt.get(sha) ?? "";
  };
  const byLast = new Map<string, CountedScenario[]>();
  for (const scenario of counted) {
    const later = commits
      .slice(commits.indexOf(scenario.commit) + 1)
      .filter((c) => c.files.some((f) => f.startsWith(FEATURES_DIR)));
    const states = [{ sha: scenario.commit.sha, content: await quotedKeys(scenario.commit.sha) }];
    for (const c of later) states.push({ sha: c.sha, content: await quotedKeys(c.sha) });
    const removing = removedBy(states, scenario.key);
    if (!removing) continue;
    const last = await revParse(ctx, `${removing}^`);
    byLast.set(last, [...(byLast.get(last) ?? []), scenario]);
  }
  const problems: Problem[] = [];
  for (const [last, scenarios] of byLast) {
    const run = await runScenarios(ctx, checkouts, last, frId);
    for (const { commit, key } of scenarios) {
      if (run.outcomes.get(key)?.outcome !== "passed") {
        problems.push({
          commit,
          what: "the scenario does not pass where it last exists",
          detail: `"${key}" at ${last.slice(0, 7)}`,
          remedy: PASS_LATER_REMEDY,
        });
      }
    }
  }
  return problems;
}

async function revParse(ctx: Context, ref: string): Promise<string> {
  return (await git(ctx, ["rev-parse", ref])).trim();
}

async function gateProblems(ctx: Context): Promise<Problem[]> {
  for (const [command, args] of QUALITY_GATE) {
    const typed = `${command} ${args.join(" ")}`;
    ctx.err(`Running the quality gate: ${typed}…\n`);
    const result = await ctx.run(command, args, { cwd: ctx.root });
    if (result.code !== 0) {
      return [
        {
          what: "the quality gate fails now",
          detail: `${typed} failed:\n${failingLines(result.output).join("\n")}`,
          remedy: "fix what it names, commit, and run the check again.",
        },
      ];
    }
  }
  return [];
}

// ── Commands ────────────────────────────────────────────────────────

/** The commit that started the record: the first whose record has `recordedBeforeChecks`. */
async function recordStart(ctx: Context): Promise<string | undefined> {
  const shas = await git(ctx, [
    "log",
    "--reverse",
    "--format=%H",
    "-S",
    "recordedBeforeChecks",
    "--",
    PROGRESS_RECORD_PATH,
  ]);
  return shas.split("\n")[0]?.trim() || undefined;
}

async function status(ctx: Context): Promise<number> {
  const states = frStates(readProgressRecord(ctx.root), await readCommits(ctx, false), await recordStart(ctx));
  if (states.size === 0) {
    ctx.out("No FR has a contract commit or a record yet.\n");
    return 0;
  }
  ctx.out(`${[...states].map(([id, state]) => formatState(id, state)).join("\n")}\n`);
  return 0;
}

async function show(ctx: Context, frId: string): Promise<number> {
  const commits = await readCommits(ctx, false);
  const state = frStates(readProgressRecord(ctx.root), commits, await recordStart(ctx)).get(frId);
  if (!state) {
    ctx.err(`${frId} has no contract commit and no record.\n`);
    return 1;
  }
  const lines = [formatState(frId, state)];
  for (const [role, label] of [
    ["contract", "Contract"],
    ["test", "Tests"],
    ["code", "Code"],
  ] as const) {
    const own = commits.filter((c) => commitRole(c.subject, frId) === role);
    lines.push("", `${label}:`, ...(own.length ? own.map((c) => `  ${c.sha.slice(0, 7)} ${c.subject}`) : ["  none"]));
  }
  ctx.out(`${lines.join("\n")}\n`);
  return 0;
}

async function check(ctx: Context, frId: string): Promise<number> {
  const fail = (problems: Problem[]) => {
    ctx.err(formatProblems(frId, problems));
    return 1;
  };
  const dirty = (await git(ctx, ["status", "--porcelain"])).trim();
  if (dirty !== "") {
    return fail([
      {
        what: "the working tree has uncommitted changes",
        detail: dirty.split("\n").join(", "),
        remedy: "commit them first, so the check verifies a commit.",
      },
    ]);
  }
  const commits = await readCommits(ctx, true);
  const structural = structuralProblems(commits, frId);
  if (structural.length > 0) return fail(structural);

  const head = commits[commits.length - 1].sha;
  const checkouts = new Checkouts(ctx, head);
  let ran: Problem[];
  try {
    ran = [
      ...(await contractProblems(ctx, checkouts, commits, frId)),
      ...(await testCommitProblems(ctx, checkouts, commits, frId, head)),
    ];
  } finally {
    await checkouts.removeAll();
  }
  if (ran.length > 0) return fail(ran);

  const gate = await gateProblems(ctx);
  if (gate.length > 0) return fail(gate);

  const record = readProgressRecord(ctx.root);
  record.built[frId] = { commit: head, date: ctx.now().toISOString().slice(0, 10) };
  writeProgressRecord(ctx.root, record);
  // The check commits its own record, so nobody handles the file.
  await git(ctx, ["add", "--", PROGRESS_RECORD_PATH]);
  await git(ctx, ["commit", "-q", "-m", `chore(progress): ${frId} verified`, "--", PROGRESS_RECORD_PATH]);
  ctx.out(`${frId} verified at ${head.slice(0, 7)}: recorded as built and committed as chore(progress): ${frId} verified.\n`);
  return 0;
}

export interface CliOptions {
  root?: string;
  run?: CommandRunner;
  out?: (text: string) => void;
  err?: (text: string) => void;
  now?: () => Date;
}

/** Runs one command and returns its exit code; it never exits the process. */
export async function runCli(argv: string[], options: CliOptions = {}): Promise<number> {
  const ctx: Context = {
    root: options.root ?? process.cwd(),
    run: options.run ?? runCommand,
    out: options.out ?? ((text) => process.stdout.write(text)),
    err: options.err ?? ((text) => process.stderr.write(text)),
    now: options.now ?? (() => new Date()),
  };
  const [command, ...args] = argv;
  if (command === undefined) {
    ctx.out(HELP);
    return 0;
  }
  const needsFrId = command === "show" || command === "check";
  if (needsFrId && (args.length !== 1 || !isFrId(args[0]))) {
    const given = args.length === 1 ? `"${args[0]}"` : `"${args.join(" ")}"`;
    ctx.err(`${given} is not an FR id (such as FR-CHAT-01 or NFR-TEST-03); nothing was run.\n`);
    return 1;
  }
  try {
    if (command === "status" && args.length === 0) return await status(ctx);
    if (command === "show") return await show(ctx, args[0]);
    if (command === "check") return await check(ctx, args[0]);
  } catch (error) {
    if (error instanceof ProgressError) {
      ctx.err(`${error.message}\n`);
      return 1;
    }
    throw error;
  }
  ctx.err(`Unknown command: ${argv.join(" ")}\n\n${HELP}`);
  return 1;
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
