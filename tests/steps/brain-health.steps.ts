// tests/steps/brain-health.steps.ts — FR-BRAIN-07 brain health linter BDD steps.

import { After, Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  computeBrainHealthReport,
  formatBrainHealthReportBlock,
  type BrainHealthReport,
} from "../../backends/consolidation-mechanics";
import { buildConsolidationPrompt } from "../../backends/consolidation-runner";
import { BRAIN_FILE_SIZE_THRESHOLD_LINES } from "../../shared/defaults";
import { setupGlobalConfigDir, teardownGlobalConfigDir } from "../support/global-config";

interface BrainHealthWorld {
  buddyDir?: string;
  tmpDir?: string;
  globalConfigDir?: string;
  report?: BrainHealthReport;
  healthBlock?: string;
  prompt?: string;
}

After(function (this: BrainHealthWorld) {
  if (this.tmpDir) rmSync(this.tmpDir, { recursive: true, force: true });
  teardownGlobalConfigDir(this.globalConfigDir);
});

function writeBrainFile(buddyDir: string, relPath: string, content: string): void {
  const abs = join(buddyDir, relPath);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, content);
}

function writeHealthyCore(buddyDir: string): void {
  writeBrainFile(
    buddyDir,
    "agent_brain/identity/SOUL.md",
    "---\nsummary: Agent character and behavioral constraints\ncreated: 2026-07-01\n---\n\n# Soul\n",
  );
  writeBrainFile(
    buddyDir,
    "agent_brain/identity/USER.md",
    "---\nsummary: User profile and preferences\ncreated: 2026-07-01\n---\n\n# User\n",
  );
  writeBrainFile(
    buddyDir,
    "agent_brain/deferred.md",
    "---\nsummary: Deferred queue for autonomous reminders\ncreated: 2026-07-01\n---\n\n# Deferred\n",
  );
  writeBrainFile(
    buddyDir,
    "agent_brain/observations.md",
    "---\nsummary: System observations staging file\ncreated: 2026-07-01\n---\n\n# Observations\n",
  );
}

Given("a temporary buddy root directory", function (this: BrainHealthWorld) {
  ({ configDir: this.globalConfigDir } = setupGlobalConfigDir({
    consolidationSkill: "# Skill\n\nDo consolidation.\n",
  }));
  this.tmpDir = mkdtempSync(join(tmpdir(), "ab-brain-health-bdd-"));
  this.buddyDir = join(this.tmpDir, "buddy");
  mkdirSync(this.buddyDir, { recursive: true });
  writeFileSync(join(this.buddyDir, "AGENTS.md"), "# Rules\n");
});

Given(
  "a brain file {string} without required frontmatter",
  function (this: BrainHealthWorld, relPath: string) {
    if (!this.buddyDir) throw new Error("buddy root not initialized");
    writeHealthyCore(this.buddyDir);
    writeBrainFile(this.buddyDir, relPath, "# Missing frontmatter\n");
  },
);

Given("the brain is missing {string}", function (this: BrainHealthWorld, relPath: string) {
  if (!this.buddyDir) throw new Error("buddy root not initialized");
  writeHealthyCore(this.buddyDir);
  const abs = join(this.buddyDir, relPath);
  if (existsSync(abs)) unlinkSync(abs);
});

Given(
  "a brain directory {string} with files {string} and {string} and no index",
  function (this: BrainHealthWorld, dirPath: string, fileA: string, fileB: string) {
    if (!this.buddyDir) throw new Error("buddy root not initialized");
    writeHealthyCore(this.buddyDir);
    writeBrainFile(
      this.buddyDir,
      `${dirPath}/${fileA}`,
      "---\nsummary: Alpha concept\ncreated: 2026-07-01\n---\n\n# Alpha\n",
    );
    writeBrainFile(
      this.buddyDir,
      `${dirPath}/${fileB}`,
      "---\nsummary: Beta concept\ncreated: 2026-07-01\n---\n\n# Beta\n",
    );
  },
);

Given(
  "a brain file {string} exceeding the size threshold",
  function (this: BrainHealthWorld, relPath: string) {
    if (!this.buddyDir) throw new Error("buddy root not initialized");
    writeHealthyCore(this.buddyDir);
    const lines = Array.from(
      { length: BRAIN_FILE_SIZE_THRESHOLD_LINES + 1 },
      (_, i) => `# Line ${i}`,
    );
    writeBrainFile(
      this.buddyDir,
      relPath,
      `---\nsummary: Large project file\ncreated: 2026-07-01\n---\n\n${lines.join("\n")}\n`,
    );
  },
);

Given("a healthy brain structure", function (this: BrainHealthWorld) {
  if (!this.buddyDir) throw new Error("buddy root not initialized");
  writeHealthyCore(this.buddyDir);
  writeBrainFile(
    this.buddyDir,
    "agent_brain/concepts/index.md",
    "---\nsummary: Concepts index\ncreated: 2026-07-01\n---\n\n# Concepts\n",
  );
  writeBrainFile(
    this.buddyDir,
    "agent_brain/concepts/one.md",
    "---\nsummary: One concept\ncreated: 2026-07-01\n---\n\n# One\n",
  );
});

Given("the global consolidation skill is available", function (this: BrainHealthWorld) {
  if (!this.globalConfigDir) {
    ({ configDir: this.globalConfigDir } = setupGlobalConfigDir({
      consolidationSkill: "# Skill\n\nDo consolidation.\n",
    }));
  }
});

When("the brain health report is computed", function (this: BrainHealthWorld) {
  if (!this.buddyDir) throw new Error("buddy root not initialized");
  this.report = computeBrainHealthReport(this.buddyDir);
  this.healthBlock = formatBrainHealthReportBlock(this.report);
});

When("the consolidation prompt is built for depth {int}", function (this: BrainHealthWorld, depth: number) {
  if (!this.buddyDir) throw new Error("buddy root not initialized");
  this.prompt = buildConsolidationPrompt(this.buddyDir, depth, new Date("2026-07-22T12:00:00Z"));
});

Then(
  "the report lists missing frontmatter for {string}",
  function (this: BrainHealthWorld, relPath: string) {
    assert.ok(this.report?.missingFrontmatter.includes(relPath));
  },
);

Then(
  "the report lists missing core file {string}",
  function (this: BrainHealthWorld, relPath: string) {
    assert.ok(this.report?.missingCoreFiles.includes(relPath));
  },
);

Then(
  "the report lists missing index for {string}",
  function (this: BrainHealthWorld, dirPath: string) {
    assert.ok(this.report?.missingIndexes.includes(dirPath));
  },
);

Then(
  "the report lists oversized file {string}",
  function (this: BrainHealthWorld, relPath: string) {
    assert.ok(this.report?.oversizedFiles.includes(relPath));
  },
);

Then("the report has no issues", function (this: BrainHealthWorld) {
  assert.deepEqual(this.report?.missingFrontmatter, []);
  assert.deepEqual(this.report?.missingCoreFiles, []);
  assert.deepEqual(this.report?.missingIndexes, []);
  assert.deepEqual(this.report?.oversizedFiles, []);
});

Then("the formatted health block is empty", function (this: BrainHealthWorld) {
  assert.equal(this.healthBlock, "");
});

Then("the prompt contains {string}", function (this: BrainHealthWorld, text: string) {
  assert.ok(this.prompt?.includes(text));
});
