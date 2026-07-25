// tests/unit/brain-health.test.ts — FR-BRAIN-07 brain health linter.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  computeBrainHealthReport,
  formatBrainHealthReportBlock,
} from "../../backends/consolidation-mechanics";
import { BRAIN_FILE_SIZE_THRESHOLD_LINES } from "../../shared/defaults";

describe("brain health linter", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  function setupRoot(): void {
    dir = mkdtempSync(join(tmpdir(), "ab-brain-health-"));
    writeFileSync(join(dir, "AGENTS.md"), "# Rules\n");
  }

  function writeBrainFile(relPath: string, content: string): void {
    const abs = join(dir, relPath);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, content);
  }

  function writeHealthyCore(): void {
    writeBrainFile(
      "agent_brain/identity/SOUL.md",
      "---\nsummary: Agent character and behavioral constraints\ncreated: 2026-07-01\n---\n\n# Soul\n",
    );
    writeBrainFile(
      "agent_brain/identity/USER.md",
      "---\nsummary: User profile and preferences\ncreated: 2026-07-01\n---\n\n# User\n",
    );
    writeBrainFile(
      "agent_brain/deferred.md",
      "---\nsummary: Deferred queue for autonomous reminders\ncreated: 2026-07-01\n---\n\n# Deferred\n",
    );
    writeBrainFile(
      "agent_brain/observations.md",
      "---\nsummary: System observations staging file\ncreated: 2026-07-01\n---\n\n# Observations\n",
    );
  }

  it("flags files missing required frontmatter", () => {
    setupRoot();
    writeHealthyCore();
    writeBrainFile("agent_brain/concepts/stale.md", "# No frontmatter\n");

    const report = computeBrainHealthReport(dir);
    expect(report.missingFrontmatter).toContain("agent_brain/concepts/stale.md");
  });

  it("flags files with empty summary or created values", () => {
    setupRoot();
    writeHealthyCore();
    writeBrainFile(
      "agent_brain/concepts/empty.md",
      "---\nsummary:\ncreated:\n---\n\n# Empty\n",
    );

    const report = computeBrainHealthReport(dir);
    expect(report.missingFrontmatter).toContain("agent_brain/concepts/empty.md");
  });

  it("flags missing core brain files", () => {
    setupRoot();
    writeBrainFile(
      "agent_brain/identity/USER.md",
      "---\nsummary: User profile\ncreated: 2026-07-01\n---\n\n# User\n",
    );
    writeBrainFile(
      "agent_brain/deferred.md",
      "---\nsummary: Deferred queue\ncreated: 2026-07-01\n---\n\n# Deferred\n",
    );

    const report = computeBrainHealthReport(dir);
    expect(report.missingCoreFiles).toContain("agent_brain/identity/SOUL.md");
  });

  it("flags when neither AGENTS.md nor CLAUDE.md exists", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-brain-health-"));
    writeHealthyCore();

    const report = computeBrainHealthReport(dir);
    expect(report.missingCoreFiles).toContain("AGENTS.md or CLAUDE.md");
  });

  it("flags directories with multiple files and no index.md", () => {
    setupRoot();
    writeHealthyCore();
    writeBrainFile(
      "agent_brain/concepts/alpha.md",
      "---\nsummary: Alpha concept\ncreated: 2026-07-01\n---\n\n# Alpha\n",
    );
    writeBrainFile(
      "agent_brain/concepts/beta.md",
      "---\nsummary: Beta concept\ncreated: 2026-07-01\n---\n\n# Beta\n",
    );

    const report = computeBrainHealthReport(dir);
    expect(report.missingIndexes).toContain("agent_brain/concepts");
  });

  it("does not flag identity directory without index.md", () => {
    setupRoot();
    writeHealthyCore();

    const report = computeBrainHealthReport(dir);
    expect(report.missingIndexes).not.toContain("agent_brain/identity");
  });

  it("flags oversized files", () => {
    setupRoot();
    writeHealthyCore();
    const lines = Array.from({ length: BRAIN_FILE_SIZE_THRESHOLD_LINES + 1 }, (_, i) => `# Line ${i}`);
    writeBrainFile(
      "agent_brain/projects/big.md",
      `---\nsummary: Large project file\ncreated: 2026-07-01\n---\n\n${lines.join("\n")}\n`,
    );

    const report = computeBrainHealthReport(dir);
    expect(report.oversizedFiles).toContain("agent_brain/projects/big.md");
  });

  it("excludes archive directory from scanning", () => {
    setupRoot();
    writeHealthyCore();
    writeBrainFile("agent_brain/archive/old.md", "# Archived without frontmatter\n");

    const report = computeBrainHealthReport(dir);
    expect(report.missingFrontmatter).not.toContain("agent_brain/archive/old.md");
  });

  it("returns no issues for a healthy brain", () => {
    setupRoot();
    writeHealthyCore();
    writeBrainFile(
      "agent_brain/concepts/index.md",
      "---\nsummary: Concepts index\ncreated: 2026-07-01\n---\n\n# Concepts\n",
    );
    writeBrainFile(
      "agent_brain/concepts/one.md",
      "---\nsummary: One concept\ncreated: 2026-07-01\n---\n\n# One\n",
    );

    const report = computeBrainHealthReport(dir);
    expect(report.missingFrontmatter).toEqual([]);
    expect(report.missingCoreFiles).toEqual([]);
    expect(report.missingIndexes).toEqual([]);
    expect(report.oversizedFiles).toEqual([]);
    expect(formatBrainHealthReportBlock(report)).toBe("");
  });

  it("formats grouped issues when present", () => {
    const block = formatBrainHealthReportBlock({
      missingFrontmatter: ["agent_brain/concepts/stale.md"],
      missingCoreFiles: ["agent_brain/identity/SOUL.md"],
      missingIndexes: ["agent_brain/projects"],
      oversizedFiles: ["agent_brain/projects/big.md"],
    });

    expect(block).toContain("Brain health (pre-computed):");
    expect(block).toContain("Missing frontmatter:");
    expect(block).toContain("agent_brain/concepts/stale.md");
    expect(block).toContain("Missing core files:");
    expect(block).toContain("Missing index.md:");
    expect(block).toContain("Oversized files:");
  });

  it("handles empty agent_brain directory gracefully", () => {
    setupRoot();
    mkdirSync(join(dir, "agent_brain"), { recursive: true });

    const report = computeBrainHealthReport(dir);
    expect(report.missingCoreFiles.length).toBeGreaterThan(0);
    expect(report.missingFrontmatter).toEqual([]);
  });
});
