// tests/steps/progress-ledger.steps.ts — NFR-TEST-03 the progress record holds
// only verified work.
//
// Every scenario runs the real check against a real git project (see
// tests/support/progress-demo.ts): its own commits, its own test runners, its
// own quality gate. Only the command runner is wrapped, to see what ran.

import { After, Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// A namespace import: at the Red commit the new exports do not exist yet, and
// named imports would stop the whole suite from loading instead of failing here.
import * as progressCli from "../../scripts/progress";
import type { CommandRunner } from "../../scripts/progress";
import {
  DemoProject,
  GREETING_CODE,
  GREETING_FEATURE,
  GREETING_STEPS,
  GREETING_UNIT_TEST,
  MISSING_FUNCTION_UNIT_TEST,
  MISSING_MODULE_UNIT_TEST,
  SHOUT_CODE,
  WEAK_UNIT_TEST,
  type PlannedCommit,
} from "../support/progress-demo";
import type { BuddyWorld } from "../support/world";

const BUDDY_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const CHECK_TIMEOUT_MS = 180_000;

/** Git subcommands that only read. Anything else counts as a command that ran. */
const READ_ONLY_GIT = new Set([
  "log",
  "rev-parse",
  "rev-list",
  "show",
  "ls-tree",
  "diff-tree",
  "status",
  "cat-file",
]);

interface CliResult {
  code: number;
  out: string;
  err: string;
}

interface ProgressWorld extends BuddyWorld {
  demo?: DemoProject;
  plan?: PlannedCommit[];
  ran?: Array<{ command: string; args: string[] }>;
  check?: CliResult;
  status?: CliResult;
  recordBefore?: string | null;
  /** HEAD when the last check started: the commit it verifies. */
  checkedHead?: string;
  helpOutput?: string;
}

const STEPS_COMMIT: PlannedCommit = {
  message: "test(demo): FR-DEMO-01 steps for the greeting",
  files: { "tests/steps/greeting.steps.js": GREETING_STEPS },
  role: "steps",
};

const UNIT_TEST_COMMIT: PlannedCommit = {
  message: "test(demo): FR-DEMO-01 greet by name",
  files: { "tests/unit/greeting.test.js": GREETING_UNIT_TEST },
  role: "unit",
};

const CODE_COMMIT: PlannedCommit = {
  message: "feat(demo): FR-DEMO-01 greet by name",
  files: { "src/greeting.js": GREETING_CODE, "src/shout.js": SHOUT_CODE },
  role: "code",
};

function demo(world: ProgressWorld): DemoProject {
  assert.ok(world.demo, "the Background must create the demo project");
  return world.demo;
}

function short(sha: string): string {
  return sha.slice(0, 7);
}

/** Commit the plan on top of the contract commit, replacing any earlier work. */
function applyPlan(world: ProgressWorld, plan: PlannedCommit[]): void {
  world.plan = plan;
  demo(world).replay(demo(world).roles.contract, plan);
}

function addToPlan(world: ProgressWorld, planned: PlannedCommit): void {
  world.plan = [...(world.plan ?? []), planned];
  demo(world).commit(planned);
}

async function progress(world: ProgressWorld, argv: string[]): Promise<CliResult> {
  const ran: Array<{ command: string; args: string[] }> = world.ran ?? [];
  world.ran = ran;
  const run: CommandRunner = (command, args, options) => {
    ran.push({ command, args });
    return progressCli.runCommand(command, args, options);
  };
  let out = "";
  let err = "";
  // The CLI runs in this process, so it must return its exit code, not exit.
  const exit = process.exit;
  process.exit = ((code?: number) => {
    throw new Error(`the progress CLI called process.exit(${code})`);
  }) as typeof process.exit;
  try {
    const code = await progressCli.runCli(argv, {
      root: demo(world).root,
      run,
      out: (text: string) => {
        out += text;
      },
      err: (text: string) => {
        err += text;
      },
    });
    return { code, out, err };
  } finally {
    process.exit = exit;
  }
}

function recordText(world: ProgressWorld): string | null {
  const path = join(demo(world).root, progressCli.PROGRESS_RECORD_PATH);
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

function statusLine(result: CliResult, frId: string): string {
  const line = result.out
    .split("\n")
    .find((l) => l.trim().split(/\s+/)[0] === frId);
  assert.ok(line, `the status has no line for ${frId}:\n${result.out}\n${result.err}`);
  return line;
}

async function freshStatus(world: ProgressWorld): Promise<CliResult> {
  const result = await progress(world, ["status"]);
  assert.equal(result.code, 0, `status failed:\n${result.err}`);
  return result;
}

function commitForRole(world: ProgressWorld, role: string): string {
  const roles = demo(world).roles;
  switch (role) {
    case "the code commit":
      return roles.code;
    case "the test commit":
      return roles.offending;
    case "the contract commit":
      return roles.contract;
    case "the commit before the code":
      return demo(world).git("rev-parse", `${roles.code}^`);
    default:
      throw new Error(`unknown commit role: ${role}`);
  }
}

/** Each situation of the refused-work outline, as the commits that make it. */
const SITUATIONS: Record<string, () => PlannedCommit[]> = {
  "the code was committed before any test": () => [
    CODE_COMMIT,
    { ...STEPS_COMMIT, files: { ...STEPS_COMMIT.files, ...UNIT_TEST_COMMIT.files } },
  ],
  "a unit test passed at its own commit": () => [
    STEPS_COMMIT,
    {
      message: "test(demo): FR-DEMO-01 greet returns text",
      files: { "tests/unit/greeting.test.js": WEAK_UNIT_TEST },
      role: "offending",
    },
    CODE_COMMIT,
  ],
  "the scenario passed before the first code": () => [
    {
      message: "chore(demo): tidy the greeting",
      files: { "src/greeting.js": GREETING_CODE },
    },
    { ...STEPS_COMMIT, role: "offending" },
    {
      message: "feat(demo): FR-DEMO-01 document the greeting",
      files: { "src/greeting.js": `// Greets a person by name.\n${GREETING_CODE}` },
      role: "code",
    },
  ],
  "a test commit also changes production code": () => [
    {
      ...STEPS_COMMIT,
      files: {
        ...STEPS_COMMIT.files,
        "src/greeting.js": "// The greeting.\nexport function greet(_name) {\n  return \"\";\n}\n",
      },
      role: "offending",
    },
    CODE_COMMIT,
  ],
  "no test was committed": () => [
    { ...CODE_COMMIT, files: { ...CODE_COMMIT.files, ...STEPS_COMMIT.files } },
  ],
  "a step was undefined before the first code": () => [
    UNIT_TEST_COMMIT,
    CODE_COMMIT,
    { ...STEPS_COMMIT, role: "offending" },
  ],
  "a test passed at its commit and its message mentions mutants without a Mutant trailer naming it": () => [
    STEPS_COMMIT,
    {
      // Mentions mutants, and its one trailer names a test this commit does not have.
      message: [
        "test(demo): FR-DEMO-01 greet returns text",
        "",
        "Checked against mutants by hand.",
        "",
        'Mutant: greets in capitals — greet() returning "" in src/greeting.js',
      ].join("\n"),
      files: { "tests/unit/greeting.test.js": WEAK_UNIT_TEST },
      role: "offending",
    },
    CODE_COMMIT,
  ],
  "the unit test failed at its commit because the function it calls did not exist yet": () => [
    STEPS_COMMIT,
    {
      message: "test(demo): FR-DEMO-01 shout",
      files: { "tests/unit/shout.test.js": MISSING_FUNCTION_UNIT_TEST },
      role: "unit",
    },
  ],
  "the unit test failed at its commit because the module it imports did not exist yet": () => [
    STEPS_COMMIT,
    {
      message: "test(demo): FR-DEMO-01 shout",
      files: { "tests/unit/shout.test.js": MISSING_MODULE_UNIT_TEST },
      role: "unit",
    },
  ],
};

After({ tags: "@NFR-TEST-03" }, function (this: ProgressWorld) {
  this.demo?.remove();
});

// ── Background ──────────────────────────────────────────────────────

Given(
  "a project with a contract commit for FR-DEMO-01 and its scenario {string}",
  function (this: ProgressWorld, scenario: string) {
    assert.ok(GREETING_FEATURE.includes(`Scenario: ${scenario}`));
    this.demo = new DemoProject();
    this.demo.commit({
      message: "spec(demo): FR-DEMO-01 a greeting is shown",
      files: { "specs/features/greeting.feature": GREETING_FEATURE },
      role: "contract",
    });
  },
);

// ── Work on FR-DEMO-01 ──────────────────────────────────────────────

Given(
  "FR-DEMO-01's step definitions committed alone, failing on an assertion",
  function (this: ProgressWorld) {
    addToPlan(this, STEPS_COMMIT);
  },
);

Given("a unit test committed alone, failing on an assertion", function (this: ProgressWorld) {
  addToPlan(this, UNIT_TEST_COMMIT);
});

Given(
  /^the code committed after (?:it|them), making the scenario and the gate pass$/,
  function (this: ProgressWorld) {
    addToPlan(this, CODE_COMMIT);
  },
);

Given("FR-DEMO-01's work done Outside-In", function (this: ProgressWorld) {
  applyPlan(this, [STEPS_COMMIT, UNIT_TEST_COMMIT, CODE_COMMIT]);
});

Given(/^FR-DEMO-01's work where (.+)$/, function (this: ProgressWorld, situation: string) {
  const plan = SITUATIONS[situation];
  assert.ok(plan, `no work is defined for the situation "${situation}"`);
  applyPlan(this, plan());
});

Given(
  "a later test commit that replaces its unit test with one for new code",
  function (this: ProgressWorld) {
    // "greets by name" leaves the suite here, so it cannot pass at HEAD; it
    // passed at the code commit, the last one where it still existed.
    addToPlan(this, {
      message: "test(demo): FR-DEMO-01 wave instead of greeting by name",
      files: {
        "tests/unit/greeting.test.js": [
          'import { expect, it } from "vitest";',
          'import * as greeting from "../../src/greeting.js";',
          'it("waves", () => { expect(greeting.wave("Ana")).toBe("Ana waves"); });',
          "",
        ].join("\n"),
      },
      role: "replacing",
    });
  },
);

Given("the code for the new test committed after it", function (this: ProgressWorld) {
  addToPlan(this, {
    message: "feat(demo): FR-DEMO-01 wave",
    files: {
      "src/greeting.js": `${GREETING_CODE}export function wave(name) {\n  return \`\${name} waves\`;\n}\n`,
    },
  });
});

Given("its test commit has a Mutant trailer naming the scenario", function (this: ProgressWorld) {
  const plan = (this.plan ?? []).map((planned) =>
    planned.message.startsWith("test(")
      ? {
          ...planned,
          message: `${planned.message}\n\nMutant: A greeting is shown — greet() returning "" in src/greeting.js`,
        }
      : planned,
  );
  assert.ok(plan.some((p) => p.message.includes("Mutant:")), "the work has no test commit");
  applyPlan(this, plan);
});

Given("the scenario and the gate pass now", function (this: ProgressWorld) {
  // The work's last commit is the working greeting; the check's own gate run
  // is what verifies it, and "the check succeeds" fails if it does not.
  assert.ok(this.plan?.some((p) => p.files["src/greeting.js"]?.includes("Hello, ${name}")));
});

Given("a scenario of another FR fails now", function (this: ProgressWorld) {
  addToPlan(this, {
    message: "chore(demo): shorten the farewell",
    files: { "src/farewell.js": 'export function farewell(_name) {\n  return "Bye";\n}\n' },
  });
});

/** Do the work Outside-In on top of the contract, check it, and commit the record. */
async function verifyOutsideIn(world: ProgressWorld): Promise<void> {
  applyPlan(world, [STEPS_COMMIT, UNIT_TEST_COMMIT, CODE_COMMIT]);
  const result = await progress(world, ["check", "FR-DEMO-01"]);
  assert.equal(result.code, 0, `the check failed:\n${result.err}`);
  // The check commits its own record; nobody handles the file.
  assert.equal(demo(world).git("status", "--porcelain"), "", "the check left its record uncommitted");
  assert.equal(demo(world).git("log", "-1", "--format=%s"), "chore(progress): FR-DEMO-01 verified");
}

/** The greeting feature with an outline of the given rows after its scenario. */
function greetingWithOutline(rows: string[]): string {
  return [
    GREETING_FEATURE,
    "  @FR-DEMO-01",
    "  Scenario Outline: Greet <name>",
    '    When I greet "<name>"',
    '    Then I see "Hello, <name>"',
    "",
    "    Examples:",
    "      | name |",
    ...rows.map((row) => `      | ${row} |`),
    "",
  ].join("\n");
}

Given("FR-DEMO-01 was verified as built", { timeout: CHECK_TIMEOUT_MS }, async function (
  this: ProgressWorld,
) {
  await verifyOutsideIn(this);
});

Given(
  "FR-DEMO-01 was verified as built with an outline of one row",
  { timeout: CHECK_TIMEOUT_MS },
  async function (this: ProgressWorld) {
    // The outline is part of the contract the work is built on.
    demo(this).commit({
      message: "spec(demo): FR-DEMO-01 greet by any name",
      files: { "specs/features/greeting.feature": greetingWithOutline(["Ana"]) },
      role: "contract",
    });
    await verifyOutsideIn(this);
  },
);

Given("a later contract commit adds a second row to that outline", function (this: ProgressWorld) {
  demo(this).commit({
    message: "spec(demo): FR-DEMO-01 greet Bo too",
    files: { "specs/features/greeting.feature": greetingWithOutline(["Ana", "Bo"]) },
  });
});

Given("the second row passed before any code for it", function (this: ProgressWorld) {
  // No code follows the row's contract commit, and the code it was verified
  // with already greets any name: the row passes wherever it runs.
  assert.ok(this.plan?.some((p) => p.files["src/greeting.js"]?.includes("Hello, ${name}")));
});

Given("a later contract commit removes one of its scenarios", function (this: ProgressWorld) {
  demo(this).commit({
    message: "spec(demo): FR-DEMO-01 drop the greeting scenario",
    files: { "specs/features/greeting.feature": "Feature: Greeting\n" },
  });
});

Given("a later contract commit for FR-DEMO-01", function (this: ProgressWorld) {
  demo(this).commit({
    message: "spec(demo): FR-DEMO-01 greet in capitals",
    files: {
      "specs/features/greeting.feature": [
        GREETING_FEATURE,
        "  @FR-DEMO-01",
        "  Scenario: A loud greeting is shown",
        '    When I shout "ana"',
        '    Then I see "ANA"',
        "",
      ].join("\n"),
    },
  });
});

Given(
  "FR-OLD-01 recorded as built before the checks existed",
  function (this: ProgressWorld) {
    progressCli.writeProgressRecord(demo(this).root, { built: {}, recordedBeforeChecks: ["FR-OLD-01"] });
    demo(this).commit({ message: "chore(progress): record built FRs", files: {} });
  },
);

Given("a contract commit for FR-OLD-02 made before the record started", function (this: ProgressWorld) {
  assert.equal(recordText(this), null, "the record has already started");
  demo(this).commit({
    message: "spec(demo): FR-OLD-02 an old contract",
    files: { "specs/features/old.feature": "Feature: Old\n  @FR-OLD-02\n  Scenario: Something old\n" },
  });
});

Given("a contract commit for FR-NEW-01 after that", function (this: ProgressWorld) {
  demo(this).commit({
    message: "spec(demo): FR-NEW-01 a new contract",
    files: { "specs/features/new.feature": "Feature: New\n  @FR-NEW-01\n  Scenario: Something new\n" },
  });
});

// ── Commands ────────────────────────────────────────────────────────

When(/^I check (FR-DEMO-0\d)$/, { timeout: CHECK_TIMEOUT_MS }, async function (
  this: ProgressWorld,
  frId: string,
) {
  this.recordBefore = recordText(this);
  this.checkedHead = demo(this).head();
  this.ran = [];
  this.check = await progress(this, ["check", frId]);
});

When("I check {string}", async function (this: ProgressWorld, argument: string) {
  this.recordBefore = recordText(this);
  this.ran = [];
  this.check = await progress(this, ["check", argument]);
});

When("I ask for the status", async function (this: ProgressWorld) {
  this.recordBefore = recordText(this);
  this.ran = [];
  this.status = await progress(this, ["status"]);
});

When("I show FR-DEMO-01", async function (this: ProgressWorld) {
  const shown = await progress(this, ["show", "FR-DEMO-01"]);
  assert.equal(shown.code, 0, `show failed:\n${shown.err}`);
  assert.match(shown.out, /FR-DEMO-01/);
});

When("I ask the progress command for help", function (this: ProgressWorld) {
  this.helpOutput = execFileSync("npm", ["run", "--silent", "progress"], {
    cwd: BUDDY_ROOT,
    encoding: "utf8",
  });
});

// ── Outcomes ────────────────────────────────────────────────────────

Then("the check succeeds", function (this: ProgressWorld) {
  assert.ok(this.check);
  assert.equal(this.check.code, 0, `the check failed:\n${this.check.err}`);
});

Then(
  "the status shows FR-DEMO-01 as built at the current commit",
  async function (this: ProgressWorld) {
    assert.ok(this.checkedHead);
    const line = statusLine(await freshStatus(this), "FR-DEMO-01");
    assert.match(line, new RegExp(`\\bbuilt at ${short(this.checkedHead)}\\b`));
    assert.match(line, /\d{4}-\d{2}-\d{2}/, "the built line carries the date");
  },
);

Then("the status shows FR-DEMO-01 as in progress", function (this: ProgressWorld) {
  assert.ok(this.status);
  assert.match(statusLine(this.status, "FR-DEMO-01"), /\bin progress\b/);
});

Then(
  "the status shows FR-DEMO-01 as changed since its verification",
  function (this: ProgressWorld) {
    assert.ok(this.status);
    assert.match(statusLine(this.status, "FR-DEMO-01"), /\bchanged since its verification\b/);
  },
);

Then(
  "the status shows FR-OLD-01 as built, recorded before the checks",
  function (this: ProgressWorld) {
    assert.ok(this.status);
    assert.match(statusLine(this.status, "FR-OLD-01"), /\bbuilt, recorded before the checks\b/);
  },
);

Then(
  "the check fails with an error that names the added row and says it passed before its code",
  function (this: ProgressWorld) {
    assert.ok(this.check);
    assert.notEqual(this.check.code, 0, "the check succeeded");
    assert.ok(this.check.err.includes('"Greet <name> | Bo"'), `the error does not name the row:\n${this.check.err}`);
    assert.match(this.check.err, /the scenario passed before its code/);
  },
);

Then(
  "the status still shows FR-DEMO-01 as changed since its verification",
  async function (this: ProgressWorld) {
    assert.equal(recordText(this), this.recordBefore, "the failed check changed the record");
    const line = statusLine(await freshStatus(this), "FR-DEMO-01");
    assert.match(line, /\bchanged since its verification\b/);
  },
);

Then("the status does not show FR-OLD-02", function (this: ProgressWorld) {
  assert.ok(this.status);
  assert.equal(this.status.code, 0, this.status.err);
  const listed = this.status.out.split("\n").filter((l) => l.trim().split(/\s+/)[0] === "FR-OLD-02");
  assert.deepEqual(listed, [], `the status lists FR-OLD-02:\n${this.status.out}`);
});

Then("the status shows FR-NEW-01 as in progress", function (this: ProgressWorld) {
  assert.ok(this.status);
  assert.match(statusLine(this.status, "FR-NEW-01"), /\bin progress\b/);
});

Then("the status still shows FR-DEMO-01 as in progress", async function (this: ProgressWorld) {
  assert.equal(recordText(this), this.recordBefore, "the failed check changed the record");
  assert.match(statusLine(await freshStatus(this), "FR-DEMO-01"), /\bin progress\b/);
});

Then(
  /^the check fails with an error that says (?!FR-DEMO-02)(?!the argument)(.+)$/,
  function (this: ProgressWorld, missing: string) {
    assert.ok(this.check);
    assert.notEqual(this.check.code, 0, "the check succeeded");
    assert.ok(this.check.err.includes(missing), `the error does not say "${missing}":\n${this.check.err}`);
  },
);

Then(/^the error names (the .+)$/, function (this: ProgressWorld, role: string) {
  assert.ok(this.check);
  const sha = commitForRole(this, role);
  assert.ok(sha, `no commit was made for ${role}`);
  assert.ok(
    this.check.err.includes(short(sha)),
    `the error does not name ${role} (${short(sha)}):\n${this.check.err}`,
  );
});

Then("the error says how to make it hold", function (this: ProgressWorld) {
  assert.ok(this.check);
  assert.match(this.check.err, /To make it hold: \S/);
});

Then(
  "the check fails with an error that shows the failing lines of the quality gate",
  function (this: ProgressWorld) {
    assert.ok(this.check);
    assert.notEqual(this.check.code, 0, "the check succeeded");
    assert.match(this.check.err, /A farewell is shown/);
    assert.match(this.check.err, /Goodbye, Ana/);
  },
);

Then(
  "the check fails with an error that says FR-DEMO-02 has no contract commit",
  function (this: ProgressWorld) {
    assert.ok(this.check);
    assert.notEqual(this.check.code, 0, "the check succeeded");
    assert.match(this.check.err, /FR-DEMO-02 has no contract commit/);
  },
);

Then("the error says to ask the person for its approved contract", function (this: ProgressWorld) {
  assert.ok(this.check);
  assert.match(this.check.err, /ask the person for its approved contract/);
});

Then(
  "the check fails with an error that says the argument is not an FR id",
  function (this: ProgressWorld) {
    assert.ok(this.check);
    assert.notEqual(this.check.code, 0, "the check succeeded");
    assert.match(this.check.err, /is not an FR id/);
  },
);

Then("no test or command was run", function (this: ProgressWorld) {
  const ran = (this.ran ?? []).filter(
    (call) => !(call.command === "git" && READ_ONLY_GIT.has(call.args[0] ?? "")),
  );
  assert.deepEqual(ran, [], "a command other than a git read ran");
});

Then("the progress record is unchanged", function (this: ProgressWorld) {
  assert.equal(recordText(this), this.recordBefore);
  assert.equal(demo(this).git("status", "--porcelain"), "", "the working tree changed");
});

Then(
  "it lists status, show and check, each as {string}",
  function (this: ProgressWorld, form: string) {
    assert.ok(this.helpOutput);
    for (const command of ["status", "show", "check"]) {
      const typed = form.replace("<command>", command);
      assert.ok(this.helpOutput.includes(typed), `help does not list "${typed}":\n${this.helpOutput}`);
    }
  },
);
