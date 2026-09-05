// tests/unit/progress-consistency.test.ts — alignment gate for specs/progress.json.
//
// Complements progress-cli.test.ts (CLI enforcement) and fr-status.test.ts
// (SPEC.md ✓ marks vs feature files). Runs as part of npm test.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ProgressData } from "../../scripts/progress";

const ROOT = join(__dirname, "..", "..");
const PROGRESS_FILE = join(ROOT, "specs", "progress.json");
const FEATURES_DIR = join(ROOT, "specs", "features");

const STEPS_REQUIRING_FEATURE_TAG = new Set([
  "bdd_red",
  "implementing",
  "bdd_green",
  "done",
]);

function loadProgress(): ProgressData {
  expect(existsSync(PROGRESS_FILE), "specs/progress.json must exist").toBe(true);
  return JSON.parse(readFileSync(PROGRESS_FILE, "utf8")) as ProgressData;
}

function featureFileContent(): string {
  const files = readdirSync(FEATURES_DIR).filter((f) => f.endsWith(".feature"));
  return files.map((f) => readFileSync(join(FEATURES_DIR, f), "utf8")).join("\n");
}

describe("progress consistency gate", () => {
  it("current_focus points to an in_progress feature or is null", () => {
    const progress = loadProgress();
    const focus = progress.current_focus;
    if (focus === null) {
      return;
    }
    const feature = progress.features.find((f) => f.id === focus);
    expect(feature, `current_focus '${focus}' not found in features`).toBeDefined();
    expect(
      feature!.status,
      `current_focus '${focus}' has status='${feature!.status}', expected 'in_progress'`,
    ).toBe("in_progress");
  });

  it("done features have all scenarios passing with at least one unit test", () => {
    const progress = loadProgress();
    for (const f of progress.features) {
      if (f.status !== "done") {
        continue;
      }
      expect(f.scenarios.length, `${f.id} is done but has no scenarios`).toBeGreaterThan(0);
      for (const s of f.scenarios) {
        expect(s.bdd, `${f.id} scenario '${s.name}' is not passing`).toBe("pass");
        expect(
          s.unit_tests,
          `${f.id} scenario '${s.name}' has no unit tests`,
        ).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("no in_progress feature has cycle_step done", () => {
    const progress = loadProgress();
    for (const f of progress.features) {
      if (f.status === "in_progress") {
        expect(
          f.cycle_step,
          `${f.id} is in_progress but cycle_step=done — use 'done' command`,
        ).not.toBe("done");
      }
    }
  });

  it("features past spec_review have @FR-xxx in a .feature file", () => {
    const progress = loadProgress();
    const content = featureFileContent();
    for (const f of progress.features) {
      if (!STEPS_REQUIRING_FEATURE_TAG.has(f.cycle_step)) {
        continue;
      }
      expect(
        content.includes(`@${f.id}`),
        `${f.id} is at step '${f.cycle_step}' but no .feature file contains @${f.id}`,
      ).toBe(true);
    }
  });
});
