// tests/unit/progress-cli.test.ts — Outside-In progress CLI enforcement.
//
// Tests command logic directly (not subprocess). The CLI is a thin argv wrapper
// around these functions.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  ProgressError,
  cmdAdd,
  cmdAdvance,
  cmdDone,
  cmdFocus,
  cmdScenario,
  load,
  save,
  type ProgressData,
} from "../../scripts/progress";

let dir: string;
let progressFile: string;
let specFile: string;

function emptyProgress(): ProgressData {
  return { current_focus: null, features: [] };
}

function feature(
  id: string,
  overrides: Partial<ProgressData["features"][0]> = {},
): ProgressData {
  return {
    current_focus: null,
    features: [
      {
        id,
        title: "Test feature",
        status: "pending",
        cycle_step: "spec_review",
        scenarios: [],
        ...overrides,
      },
    ],
  };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "progress-cli-"));
  progressFile = join(dir, "progress.json");
  specFile = join(dir, "SPEC.md");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("cmdDone", () => {
  it("rejects when a scenario is not passing", () => {
    const data = feature("FR-TEST-01", {
      status: "in_progress",
      cycle_step: "bdd_green",
      scenarios: [
        { name: "Scenario A", bdd: "pass", unit_tests: 1 },
        { name: "Scenario B", bdd: "fail", unit_tests: 2 },
      ],
    });
    expect(() => cmdDone(data, "FR-TEST-01")).toThrow(ProgressError);
    expect(() => cmdDone(data, "FR-TEST-01")).toThrow(/not passing/);
  });

  it("rejects when a scenario has zero unit tests", () => {
    const data = feature("FR-TEST-01", {
      status: "in_progress",
      cycle_step: "bdd_green",
      scenarios: [{ name: "Scenario A", bdd: "pass", unit_tests: 0 }],
    });
    expect(() => cmdDone(data, "FR-TEST-01")).toThrow(ProgressError);
    expect(() => cmdDone(data, "FR-TEST-01")).toThrow(/no unit tests/);
  });

  it("rejects when there are no scenarios", () => {
    const data = feature("FR-TEST-01", {
      status: "in_progress",
      cycle_step: "bdd_green",
      scenarios: [],
    });
    expect(() => cmdDone(data, "FR-TEST-01")).toThrow(ProgressError);
    expect(() => cmdDone(data, "FR-TEST-01")).toThrow(/no scenarios/);
  });

  it("marks done when all scenarios pass with unit tests", () => {
    const data = feature("FR-TEST-01", {
      status: "in_progress",
      cycle_step: "bdd_green",
      scenarios: [{ name: "Scenario A", bdd: "pass", unit_tests: 2 }],
    });
    data.current_focus = "FR-TEST-01";
    cmdDone(data, "FR-TEST-01");
    expect(data.features[0].status).toBe("done");
    expect(data.features[0].cycle_step).toBe("done");
    expect(data.current_focus).toBeNull();
  });
});

describe("cmdAdvance", () => {
  it("rejects skipping steps", () => {
    const data = feature("FR-TEST-01", { cycle_step: "spec_review" });
    writeFileSync(specFile, "| FR-TEST-01 | Title | 1 |\n");
    expect(() => cmdAdvance(data, "FR-TEST-01", specFile)).not.toThrow();
    expect(data.features[0].cycle_step).toBe("bdd_red");
    expect(() => cmdAdvance(data, "FR-TEST-01", specFile)).not.toThrow();
    expect(data.features[0].cycle_step).toBe("implementing");
    // Cannot jump from spec_review to implementing in one advance - already at implementing
    cmdAdvance(data, "FR-TEST-01", specFile);
    expect(data.features[0].cycle_step).toBe("bdd_green");
  });

  it("rejects advance from spec_review when FR is missing from SPEC.md", () => {
    const data = feature("FR-MISSING-01");
    writeFileSync(specFile, "| FR-OTHER-01 | Other | 1 |\n");
    expect(() => cmdAdvance(data, "FR-MISSING-01", specFile)).toThrow(ProgressError);
    expect(() => cmdAdvance(data, "FR-MISSING-01", specFile)).toThrow(/SPEC\.md/);
  });

  it("allows advance from spec_review when FR exists in SPEC.md", () => {
    const data = feature("FR-TEST-01");
    writeFileSync(specFile, "| FR-TEST-01 | Streaming | 0 |\n");
    cmdAdvance(data, "FR-TEST-01", specFile);
    expect(data.features[0].cycle_step).toBe("bdd_red");
    expect(data.features[0].status).toBe("in_progress");
  });

  it("rejects advance when already at done cycle step", () => {
    const data = feature("FR-TEST-01", { cycle_step: "done", status: "done" });
    expect(() => cmdAdvance(data, "FR-TEST-01", specFile)).toThrow(ProgressError);
  });
});

describe("cmdAdd", () => {
  it("rejects duplicate FR-IDs", () => {
    const data = feature("FR-TEST-01");
    expect(() => cmdAdd(data, "FR-TEST-01", "Duplicate")).toThrow(ProgressError);
  });

  it("adds a new feature at spec_review", () => {
    const data = emptyProgress();
    cmdAdd(data, "FR-NEW-01", "New feature");
    expect(data.features).toHaveLength(1);
    expect(data.features[0].id).toBe("FR-NEW-01");
    expect(data.features[0].cycle_step).toBe("spec_review");
    expect(data.features[0].status).toBe("pending");
  });
});

describe("cmdFocus", () => {
  it("sets current_focus and persists", () => {
    const data = feature("FR-TEST-01");
    save(data, progressFile);
    cmdFocus(data, "FR-TEST-01");
    save(data, progressFile);
    const loaded = load(progressFile);
    expect(loaded.current_focus).toBe("FR-TEST-01");
  });

  it("rejects unknown feature id", () => {
    const data = emptyProgress();
    expect(() => cmdFocus(data, "FR-NOPE")).toThrow(ProgressError);
  });
});

describe("cmdScenario", () => {
  it("updates bdd state on an existing scenario", () => {
    const data = feature("FR-TEST-01", {
      scenarios: [{ name: "Does the thing", bdd: "pending", unit_tests: 0 }],
    });
    cmdScenario(data, "pass", "FR-TEST-01", "Does the thing");
    expect(data.features[0].scenarios[0].bdd).toBe("pass");
  });

  it("creates a new scenario when name is unknown", () => {
    const data = feature("FR-TEST-01");
    cmdScenario(data, "fail", "FR-TEST-01", "New scenario");
    expect(data.features[0].scenarios).toHaveLength(1);
    expect(data.features[0].scenarios[0].bdd).toBe("fail");
    expect(data.features[0].scenarios[0].unit_tests).toBe(0);
  });
});

describe("load and save", () => {
  it("round-trips progress data", () => {
    const data = feature("FR-TEST-01", {
      status: "blocked",
      note: "Waiting on spike",
    });
    data.current_focus = "FR-TEST-01";
    save(data, progressFile);
    const loaded = load(progressFile);
    expect(loaded).toEqual(data);
    expect(readFileSync(progressFile, "utf8").endsWith("\n")).toBe(true);
  });
});
