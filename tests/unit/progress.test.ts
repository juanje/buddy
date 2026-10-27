// tests/unit/progress.test.ts — NFR-TEST-03 rules of the progress check.
//
// The check itself, against real commits and runners, is driven by
// progress-ledger.feature. These cover the rules it applies to what it reads.

import { describe, expect, it } from "vitest";

import {
  commitRole,
  failingLines,
  formatProblems,
  frStates,
  formatState,
  isFrId,
  loadFailure,
  mutantTrailers,
  passedBeforeCodeRemedy,
  removedBy,
  scenarioName,
  runCli,
  scenarioOutcomes,
  scenariosTagged,
  structuralProblems,
  unitOutcomes,
  type Commit,
} from "../../scripts/progress";

function commit(sha: string, message: string, files: string[] = []): Commit {
  return { sha, subject: message.split("\n")[0], message, files };
}

describe("isFrId", () => {
  it("accepts FR and NFR ids, with an optional letter suffix", () => {
    for (const id of ["FR-DEMO-01", "NFR-TEST-03", "FR-PERM-06b", "NFR-SEC-21", "FR-A-B-1"]) {
      expect(isFrId(id), id).toBe(true);
    }
  });

  it("refuses paths, shell syntax, options and partial ids", () => {
    for (const arg of ["../specs", "FR-DEMO-01; ls", "--upload-pack=x", "FR-DEMO", "fr-demo-01", "", " FR-DEMO-01"]) {
      expect(isFrId(arg), arg).toBe(false);
    }
  });
});

describe("commitRole", () => {
  it("reads the role from the type, for the FR named in the subject", () => {
    expect(commitRole("spec(test): NFR-TEST-03 the record", "NFR-TEST-03")).toBe("contract");
    expect(commitRole("test(demo): FR-DEMO-01 steps", "FR-DEMO-01")).toBe("test");
    expect(commitRole("feat(demo): FR-DEMO-01 greet", "FR-DEMO-01")).toBe("code");
    expect(commitRole("fix(FR-DATA-02): accept a map", "FR-DATA-02")).toBe("code");
    expect(commitRole("fix: FR-DEMO-01 typo", "FR-DEMO-01")).toBe("code");
  });

  it("does not take another FR whose id contains this one", () => {
    expect(commitRole("spec(test): NFR-TEST-03 x", "FR-TEST-03")).toBeUndefined();
    expect(commitRole("feat(perm): FR-PERM-06b x", "FR-PERM-06")).toBeUndefined();
    expect(commitRole("feat(demo): FR-DEMO-010 x", "FR-DEMO-01")).toBeUndefined();
  });

  it("gives no role to other types or to an FR named only in the body", () => {
    expect(commitRole("docs(demo): FR-DEMO-01 explain", "FR-DEMO-01")).toBeUndefined();
    expect(commitRole("refactor(demo): FR-DEMO-01 split", "FR-DEMO-01")).toBeUndefined();
    expect(commitRole("feat(demo): greet", "FR-DEMO-01")).toBeUndefined();
  });
});

describe("mutantTrailers", () => {
  it("reads the name in each Mutant trailer line", () => {
    const message = [
      "test(x): FR-X-01 guards",
      "",
      "Proved by mutants.",
      "",
      "Mutant: refuses a path outside the root — dropped the containment check",
      "Mutant: A greeting is shown — greet() returning \"\"",
    ].join("\n");
    expect([...mutantTrailers(message)]).toEqual(["refuses a path outside the root", "A greeting is shown"]);
  });

  it("names nothing for a message that only mentions mutants", () => {
    expect(mutantTrailers("test(x): FR-X-01 mutant checks\n\nProved by mutants, each failing one test.").size).toBe(0);
  });

  it("needs a name and what was broken, on a line of its own", () => {
    for (const line of ["Mutant: no dash here", "Mutant:  — only what was broken", "  Mutant: indented — x", "See Mutant: a — b"]) {
      expect(mutantTrailers(`test(x): y\n\n${line}`).size, line).toBe(0);
    }
  });
});

describe("passedBeforeCodeRemedy", () => {
  it("says to add the trailer that names the test, not to name the mutant in the message", () => {
    const remedy = passedBeforeCodeRemedy("greets by name");
    expect(remedy).toContain("Mutant: greets by name — <what you broke>");
    expect(remedy).toContain("trailer");
    expect(remedy).not.toContain("name the mutant in");
  });
});

describe("scenariosTagged", () => {
  const feature = [
    "Feature: Greeting",
    "  @FR-DEMO-01",
    "  Scenario: A greeting is shown",
    "    When I greet",
    "",
    "  @FR-DEMO-02 @smoke",
    "  Scenario: Another FR",
    "    When I wave",
    "",
    "  @smoke @FR-DEMO-01",
    "  Scenario Outline: Greet <who>",
    "    When I greet <who>",
    "    Examples:",
    "      | who |",
    "      | Bo  |",
  ].join("\n");

  it("lists the scenarios tagged with the FR, and each example row of an outline as its own", () => {
    expect(scenariosTagged(feature, "FR-DEMO-01")).toEqual(["A greeting is shown", "Greet <who> | Bo"]);
  });

  it("keys a row by its cells, across every Examples block of the outline", () => {
    const outline = [
      "  @FR-DEMO-04",
      "  Scenario Outline: Refused <case>",
      "    When I try <case>",
      "    Examples:",
      "      | case       | reason  |",
      "      | ../specs   | a path  |",
      "      | --x        | option  |",
      "",
      "    Examples:",
      "      | case | reason |",
      "      | ;ls  | shell  |",
    ].join("\n");
    expect(scenariosTagged(outline, "FR-DEMO-04")).toEqual([
      "Refused <case> | ../specs | a path",
      "Refused <case> | --x | option",
      "Refused <case> | ;ls | shell",
    ]);
  });

  it("applies a feature-level tag to every scenario", () => {
    const tagged = ["@FR-DEMO-03", "Feature: All", "  Scenario: One", "  Scenario: Two"].join("\n");
    expect(scenariosTagged(tagged, "FR-DEMO-03")).toEqual(["One", "Two"]);
  });

  it("does not match an FR whose id contains this one", () => {
    expect(scenariosTagged(feature.replaceAll("FR-DEMO-01", "FR-DEMO-010"), "FR-DEMO-01")).toEqual([]);
  });
});

describe("scenarioName", () => {
  it("is the scenario or outline a key belongs to", () => {
    expect(scenarioName("A greeting is shown")).toBe("A greeting is shown");
    expect(scenarioName("Greet <who> | Bo")).toBe("Greet <who>");
  });
});

/** A cucumber message stream with one scenario whose pickles end in the given step statuses. */
function messages(scenarios: Record<string, string[][]>): string {
  const lines: object[] = [];
  // An outline (a name with a <placeholder>) gets one example row per pickle, cells "row0", "row1"...
  const children = Object.entries(scenarios).map(([name, pickles], i) => ({
    scenario: {
      id: `s${i}`,
      name,
      examples: name.includes("<")
        ? [{ tableBody: pickles.map((_, j) => ({ id: `row${i}-${j}`, cells: [{ value: `row${j}` }] })) }]
        : [],
    },
  }));
  lines.push({ gherkinDocument: { feature: { children } } });
  Object.entries(scenarios).forEach(([name, pickles], i) => {
    pickles.forEach((statuses, j) => {
      const id = `${i}-${j}`;
      const astNodeIds = name.includes("<") ? [`s${i}`, `row${i}-${j}`] : [`s${i}`];
      lines.push({ pickle: { id: `p${id}`, name, astNodeIds } });
      lines.push({ testCase: { id: `tc${id}`, pickleId: `p${id}` } });
      lines.push({ testCaseStarted: { id: `tcs${id}`, testCaseId: `tc${id}` } });
      for (const status of statuses) {
        lines.push({
          testStepFinished: {
            testCaseStartedId: `tcs${id}`,
            testStepResult: { status, message: status === "FAILED" ? "AssertionError: '' !== 'Hello'" : undefined },
          },
        });
      }
    });
  });
  return lines.map((l) => JSON.stringify(l)).join("\n");
}

describe("scenarioOutcomes", () => {
  it("counts a step that failed while it ran as failing first", () => {
    const outcomes = scenarioOutcomes(messages({ "A greeting": [["PASSED", "FAILED", "SKIPPED"]] }));
    expect(outcomes.get("A greeting")?.outcome).toBe("fails first");
    expect(outcomes.get("A greeting")?.detail).toContain("AssertionError");
  });

  it("reports a scenario whose steps all passed as passed", () => {
    expect(scenarioOutcomes(messages({ A: [["PASSED", "PASSED"]] })).get("A")?.outcome).toBe("passed");
  });

  it("does not count an undefined, pending, ambiguous or skipped step as failing first", () => {
    for (const status of ["UNDEFINED", "PENDING", "AMBIGUOUS", "SKIPPED"]) {
      const outcome = scenarioOutcomes(messages({ A: [["PASSED", status]] })).get("A");
      expect(outcome?.outcome, status).toBe("never ran");
      expect(outcome?.detail, status).toContain(status.toLowerCase());
    }
  });

  it("gives each example row of an outline its own outcome, keyed by its cells", () => {
    const outcomes = scenarioOutcomes(messages({ "Greet <who>": [["FAILED"], ["PASSED"], ["UNDEFINED"]] }));
    expect(outcomes.get("Greet <who> | row0")?.outcome).toBe("fails first");
    expect(outcomes.get("Greet <who> | row1")?.outcome).toBe("passed");
    expect(outcomes.get("Greet <who> | row2")?.outcome).toBe("never ran");
    expect(outcomes.has("Greet <who>")).toBe(false);
  });
});

describe("loadFailure", () => {
  it("counts a project module that does not exist yet as failing first", () => {
    const cucumber =
      "Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/tmp/wt/src/shout.js' imported from /tmp/wt/tests/steps/g.steps.js";
    const vitest = "Cannot find module '../../src/shout.js' imported from /tmp/wt/tests/unit/b.test.js";
    expect(loadFailure(cucumber).outcome).toBe("fails first");
    expect(loadFailure(vitest).outcome).toBe("fails first");
  });

  it("counts an export that a project module does not provide yet as failing first", () => {
    const output = "SyntaxError: The requested module '../../src/greeting.js' does not provide an export named 'shout'";
    expect(loadFailure(output).outcome).toBe("fails first");
  });

  it("does not count a missing package, a module in node_modules or a syntax error", () => {
    for (const output of [
      "Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'no-such-pkg' imported from /tmp/wt/tests/steps/z.steps.js",
      "Cannot find module '/tmp/wt/node_modules/foo/index.js' imported from /tmp/wt/tests/steps/z.steps.js",
      "SyntaxError: The requested module 'some-pkg' does not provide an export named 'x'",
      "SyntaxError: Unexpected strict mode reserved word",
    ]) {
      const failure = loadFailure(output);
      expect(failure.outcome, output).toBe("did not fail first");
      expect(failure.detail, output).not.toBe("");
    }
  });
});

describe("unitOutcomes", () => {
  const report = JSON.stringify({
    testResults: [
      {
        name: "/repo/tests/unit/a.test.js",
        status: "failed",
        message: "",
        assertionResults: [
          {
            fullName: "greeting greets",
            title: "greets",
            status: "failed",
            failureMessages: ["AssertionError: expected '' to be 'Hello'"],
          },
          { fullName: "calls missing", status: "failed", failureMessages: ["TypeError: g.shout is not a function"] },
          { fullName: "returns text", status: "passed", failureMessages: [] },
          { fullName: "later", status: "skipped", failureMessages: [] },
        ],
      },
      {
        name: "/repo/tests/unit/b.test.js",
        status: "failed",
        message: "Cannot find module '../../src/shout.js' imported from /repo/tests/unit/b.test.js",
        assertionResults: [],
      },
    ],
  });

  it("reads each test's outcome, by file relative to the root", () => {
    const files = unitOutcomes(report, "/repo");
    const tests = files.get("tests/unit/a.test.js")?.tests;
    expect(tests?.get("greeting greets")?.outcome).toBe("fails first");
    expect(tests?.get("greeting greets")?.title).toBe("greets");
    expect(tests?.get("calls missing")?.outcome).toBe("fails first");
    expect(tests?.get("returns text")?.outcome).toBe("passed");
    expect(tests?.get("later")?.outcome).toBe("never ran");
  });

  it("reads a file that failed to load as a load failure", () => {
    const file = unitOutcomes(report, "/repo").get("tests/unit/b.test.js");
    expect(file?.load?.outcome).toBe("fails first");
    expect(file?.tests.size).toBe(0);
  });
});

describe("structuralProblems", () => {
  const contract = commit("c0ffee1", "spec(demo): FR-DEMO-01 a greeting");
  const steps = commit("5e1e5e1", "test(demo): FR-DEMO-01 steps", ["tests/steps/g.steps.js"]);
  const code = commit("feedfac", "feat(demo): FR-DEMO-01 greet", ["src/greeting.js"]);

  it("finds nothing in work done Outside-In", () => {
    expect(structuralProblems([contract, steps, code], "FR-DEMO-01")).toEqual([]);
  });

  it("refuses an FR with no contract commit, saying to ask the person", () => {
    const problems = structuralProblems([steps, code], "FR-DEMO-01");
    expect(problems).toHaveLength(1);
    expect(problems[0].what).toBe("FR-DEMO-01 has no contract commit");
    expect(problems[0].remedy).toContain("ask the person for its approved contract");
  });

  it("names the contract commit when there is no test commit", () => {
    const problems = structuralProblems([contract, code], "FR-DEMO-01");
    expect(problems.map((p) => [p.commit?.sha, p.what])).toEqual([["c0ffee1", "there is no test commit"]]);
  });

  it("names each code commit that comes before the first test commit", () => {
    const problems = structuralProblems([contract, code, steps], "FR-DEMO-01");
    expect(problems.map((p) => [p.commit?.sha, p.what])).toEqual([["feedfac", "the code came before its test"]]);
  });

  it("names a test commit that changes backends/, src/ or shared/", () => {
    for (const path of ["backends/x.ts", "src/lib/y.ts", "shared/z.ts"]) {
      const mixed = commit("bad7e57", "test(demo): FR-DEMO-01 steps", ["tests/steps/g.steps.js", path]);
      const problems = structuralProblems([contract, mixed, code], "FR-DEMO-01");
      expect(problems.map((p) => [p.commit?.sha, p.what]), path).toEqual([
        ["bad7e57", "the test commit changes production code"],
      ]);
      expect(problems[0].detail, path).toContain(path);
    }
  });

  it("lets a test commit change tests, scripts and docs", () => {
    const tooling = commit("7e57abc", "test(demo): FR-DEMO-01 steps", ["tests/steps/g.ts", "scripts/s.ts", "docs/d.md"]);
    expect(structuralProblems([contract, tooling, code], "FR-DEMO-01")).toEqual([]);
  });
});

describe("formatProblems", () => {
  it("names the commit, says what is missing and how to make it hold", () => {
    const text = formatProblems("FR-DEMO-01", [
      {
        commit: commit("feedfacecafe", "feat(demo): FR-DEMO-01 greet"),
        what: "the code came before its test",
        detail: "it comes first",
        remedy: "reorder the commits.",
      },
    ]);
    expect(text).toContain("FR-DEMO-01");
    expect(text).toContain("nothing was recorded");
    expect(text).toContain("feedfac feat(demo): FR-DEMO-01 greet");
    expect(text).toContain("the code came before its test: it comes first");
    expect(text).toContain("To make it hold: reorder the commits.");
  });
});

describe("frStates", () => {
  const contract = commit("aaaaaaa1", "spec(demo): FR-DEMO-01 a greeting");
  const code = commit("bbbbbbb2", "feat(demo): FR-DEMO-01 greet");
  const later = commit("ccccccc3", "spec(demo): FR-DEMO-01 louder");
  const other = commit("ddddddd4", "spec(demo): FR-DEMO-02 a farewell");

  it("shows an FR with a contract and no verification as in progress", () => {
    const states = frStates({ built: {}, recordedBeforeChecks: [] }, [contract, code]);
    expect(states.get("FR-DEMO-01")).toEqual({ state: "in progress" });
  });

  it("shows a verified FR as built at its commit and date", () => {
    const record = { built: { "FR-DEMO-01": { commit: "bbbbbbb2", date: "2026-10-26" } }, recordedBeforeChecks: [] };
    expect(frStates(record, [contract, code, other]).get("FR-DEMO-01")).toEqual({
      state: "built",
      commit: "bbbbbbb2",
      date: "2026-10-26",
    });
  });

  it("shows a verified FR as changed when a contract commit comes after its verification", () => {
    const record = { built: { "FR-DEMO-01": { commit: "bbbbbbb2", date: "2026-10-26" } }, recordedBeforeChecks: [] };
    expect(frStates(record, [contract, code, later]).get("FR-DEMO-01")?.state).toBe("changed");
  });

  it("shows an FR recorded before the checks as such, until a check verifies it", () => {
    const legacy = { built: {}, recordedBeforeChecks: ["FR-OLD-01", "FR-DEMO-01"] };
    expect(frStates(legacy, [contract]).get("FR-OLD-01")).toEqual({ state: "recorded before the checks" });
    expect(frStates(legacy, [contract]).get("FR-DEMO-01")).toEqual({ state: "recorded before the checks" });
    const verified = { ...legacy, built: { "FR-DEMO-01": { commit: "aaaaaaa1", date: "2026-10-26" } } };
    expect(frStates(verified, [contract]).get("FR-DEMO-01")?.state).toBe("built");
  });
});

describe("formatState", () => {
  it("writes one line per FR with its state", () => {
    expect(formatState("FR-DEMO-01", { state: "in progress" })).toBe("FR-DEMO-01  in progress");
    expect(formatState("FR-DEMO-01", { state: "built", commit: "bbbbbbb2xx", date: "2026-10-26" })).toBe(
      "FR-DEMO-01  built at bbbbbbb on 2026-10-26",
    );
    expect(formatState("FR-DEMO-01", { state: "changed", commit: "bbbbbbb2xx", date: "2026-10-26" })).toBe(
      "FR-DEMO-01  changed since its verification at bbbbbbb on 2026-10-26",
    );
    expect(formatState("FR-OLD-01", { state: "recorded before the checks" })).toBe(
      "FR-OLD-01  built, recorded before the checks",
    );
  });
});

describe("failingLines", () => {
  it("keeps cucumber's failures block without its stack", () => {
    const output = [
      "......F.",
      "Failures:",
      "",
      "1) Scenario: A farewell is shown # specs/features/farewell.feature:3",
      "   ✖ Then I read \"Goodbye, Ana\" # tests/steps/farewell.steps.js:6",
      "       AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:",
      "       'Bye' !== 'Goodbye, Ana'",
      "           at World.<anonymous> (file:///tmp/farewell.steps.js:6:38)",
      "",
      "2 scenarios (1 failed, 1 passed)",
      "4 steps (1 failed, 3 passed)",
    ].join("\n");
    const lines = failingLines(output).join("\n");
    expect(lines).toContain("Scenario: A farewell is shown");
    expect(lines).toContain("'Bye' !== 'Goodbye, Ana'");
    expect(lines).toContain("2 scenarios (1 failed, 1 passed)");
    expect(lines).not.toContain("at World.");
    expect(lines).not.toContain("......F.");
  });

  it("keeps vitest's failed tests block", () => {
    const output = [
      " ✓ tests/unit/ok.test.ts (3 tests) 4ms",
      " ❯ tests/unit/bad.test.ts (1 test | 1 failed) 5ms",
      "⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯",
      " FAIL  tests/unit/bad.test.ts > adds",
      "AssertionError: expected 1 to be 2",
      " Test Files  1 failed | 1 passed (2)",
    ].join("\n");
    const lines = failingLines(output).join("\n");
    expect(lines).toContain("FAIL  tests/unit/bad.test.ts > adds");
    expect(lines).toContain("expected 1 to be 2");
    expect(lines).not.toContain("ok.test.ts");
  });

  it("keeps tsc's errors", () => {
    const output = "src/a.ts(3,5): error TS2322: Type 'string' is not assignable to type 'number'.\nnoise";
    expect(failingLines(output)).toEqual([
      "src/a.ts(3,5): error TS2322: Type 'string' is not assignable to type 'number'.",
    ]);
  });

  it("falls back to the end of the output", () => {
    const output = Array.from({ length: 100 }, (_, i) => `line ${i}`).join("\n");
    const lines = failingLines(output);
    expect(lines.at(-1)).toBe("line 99");
    expect(lines.length).toBeLessThanOrEqual(40);
  });
});

describe("check on a working tree with uncommitted changes", () => {
  it("refuses, saying to commit them first, and runs nothing else", async () => {
    const ran: string[][] = [];
    let err = "";
    const code = await runCli(["check", "FR-DEMO-01"], {
      root: "/repo",
      run: async (command, args) => {
        ran.push([command, ...args]);
        return { code: 0, output: " M src/greeting.js\n" };
      },
      out: () => {},
      err: (text) => {
        err += text;
      },
    });
    expect(code).toBe(1);
    expect(err).toContain("the working tree has uncommitted changes: M src/greeting.js");
    expect(err).toContain("To make it hold: commit them first, so the check verifies a commit.");
    expect(err).not.toMatch(/stash/i);
    expect(ran).toEqual([["git", "status", "--porcelain"]]);
  });
});

describe("removedBy", () => {
  const states = (...contents: Array<string | null>) => contents.map((content, i) => ({ sha: `c${i}`, content }));

  it("is undefined while the test still exists in the last state", () => {
    expect(removedBy(states('it("greets")', 'it("greets"); it("waves")'), "greets")).toBeUndefined();
  });

  it("is the commit that removed the test after it last existed", () => {
    expect(removedBy(states('it("greets")', 'it("greets") // tidy', 'it("waves")', 'it("waves", 2)'), "greets")).toBe("c2");
  });

  it("follows a test that was removed and added back", () => {
    expect(removedBy(states('it("greets")', 'it("waves")', 'it("greets")'), "greets")).toBeUndefined();
  });

  it("is the commit that deleted the file, for a whole file", () => {
    expect(removedBy(states("x", "y", null), undefined)).toBe("c2");
    expect(removedBy(states("x", null, "z"), undefined)).toBeUndefined();
  });
});
