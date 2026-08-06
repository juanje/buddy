// tests/unit/prompt.test.ts — system prompt and session context assembly.

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { readFileSync } from "node:fs";

import { assembleSessionContext, assembleSystemPrompt } from "../../backends/prompt";
import { bundledPromptsDir } from "../../backends/deploy-bundled-content";
import { setupGlobalConfigDir, teardownGlobalConfigDir } from "../support/global-config";

describe("assembleSessionContext last log selection", () => {
  let dir: string;
  let globalConfigDir: string | undefined;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    teardownGlobalConfigDir(globalConfigDir, vi);
    globalConfigDir = undefined;
  });

  it("loads the last index entry regardless of maintenance status", () => {
    ({ configDir: globalConfigDir } = setupGlobalConfigDir({ agentsBase: "# Base\n" }, vi));
    dir = mkdtempSync(join(tmpdir(), "buddy-prompt-"));
    mkdirSync(join(dir, "logs"), { recursive: true });
    writeFileSync(
      join(dir, "logs", "index.md"),
      [
        "# Sessions index",
        "",
        "Log files: `logs/YYYY-MM-DD.md` (derive from the date in each entry).",
        "",
        "- 2026-07-20: active — Prior day.",
        "- 2026-07-21: maintenance — Weekly consolidation.",
        "",
      ].join("\n"),
      "utf8",
    );
    writeFileSync(
      join(dir, "logs", "2026-07-21.md"),
      [
        "---",
        "date: 2026-07-21",
        "status: maintenance",
        "---",
        "",
        "## Session 14:00–18:00",
        "",
        "### Context",
        "FR-CONSOL heartbeat shipped.",
        "",
      ].join("\n"),
      "utf8",
    );

    const { message } = assembleSessionContext(dir, new Date("2026-07-22T12:00:00Z"));

    expect(message).toContain("# Last session log");
    const lastLogSection = message.split("# Last session log")[1]?.split("\n\n---\n\n")[0] ?? "";
    expect(lastLogSection).toContain("FR-CONSOL heartbeat shipped.");
    expect(lastLogSection).not.toContain("Prior day.");
  });
});

describe("assembleSystemPrompt", () => {
  let dir: string;
  let globalConfigDir: string | undefined;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    teardownGlobalConfigDir(globalConfigDir, vi);
    globalConfigDir = undefined;
  });

  it("includes agents-base before instance rules and excludes session logs", () => {
    ({ configDir: globalConfigDir } = setupGlobalConfigDir({
      agentsBase: "# Your environment\n\nGlobal base rules.\n",
    }, vi));
    dir = mkdtempSync(join(tmpdir(), "buddy-prompt-"));
    writeFileSync(join(dir, "AGENTS.md"), "# Instance\n\nInstance rules.\n");
    mkdirSync(join(dir, "logs"), { recursive: true });
    writeFileSync(join(dir, "logs", "index.md"), "# Sessions index\n\n- 2026-07-21: active\n");
    writeFileSync(join(dir, "logs", "2026-07-21.md"), "## Session\n\nLog body.\n");

    const { prompt } = assembleSystemPrompt(dir, new Date("2026-07-22T12:00:00Z"));
    const ctx = assembleSessionContext(dir, new Date("2026-07-22T12:00:00Z"));

    const baseIndex = prompt.indexOf("Global base rules.");
    const instanceIndex = prompt.indexOf("Instance rules.");
    expect(baseIndex).toBeGreaterThanOrEqual(0);
    expect(instanceIndex).toBeGreaterThan(baseIndex);
    expect(prompt).not.toContain("# Sessions index");
    expect(ctx.message).toContain("# Sessions index");
  });

  it("returns date-only session context when nothing episodic applies", () => {
    ({ configDir: globalConfigDir } = setupGlobalConfigDir({ agentsBase: "# Base\n" }, vi));
    dir = mkdtempSync(join(tmpdir(), "buddy-prompt-"));
    mkdirSync(join(dir, "agent_brain", "identity"), { recursive: true });
    writeFileSync(
      join(dir, "agent_brain", "identity", "USER.md"),
      "# User\n\n- **Name:** Juanje\n",
    );

    const ctx = assembleSessionContext(dir, new Date("2026-07-22T12:00:00Z"));

    expect(ctx.message).toContain("# Today");
    expect(ctx.message).not.toContain("# Sessions index");
    expect(ctx.message).not.toContain("# Pending items");
    expect(ctx.personalizationPending).toBe(false);
  });
});

// FR-PROMPT-06: edit batching guidance in agents-base.md.
describe("agents-base edit batching guidance", () => {
  it("instructs one edit per change", () => {
    const base = readFileSync(
      join(bundledPromptsDir(), "agents-base.md"),
      "utf8",
    );
    expect(base).toContain("one `edit` call per change");
  });
});

// FR-PROMPT-07: queue file anchoring guidance (#20).
describe("agents-base queue file anchoring", () => {
  it("instructs anchoring on section headings, not frontmatter delimiters", () => {
    const base = readFileSync(
      join(bundledPromptsDir(), "agents-base.md"),
      "utf8",
    );
    expect(base).toMatch(/anchor.*heading|heading.*anchor/i);
    expect(base).toMatch(/never.*`---`|not.*`---`/i);
  });
});

// Consolidation prompt: brain health repair instructions (#24, #25).
describe("consolidation prompt brain health repair", () => {
  it("instructs edit for frontmatter repair, not write (#24)", () => {
    const prompt = readFileSync(
      join(bundledPromptsDir(), "consolidation.md"),
      "utf8",
    );
    expect(prompt).toMatch(/`edit`.*frontmatter|frontmatter.*`edit`/i);
  });

  it("instructs git log for created date when absent, not today (#25)", () => {
    const prompt = readFileSync(
      join(bundledPromptsDir(), "consolidation.md"),
      "utf8",
    );
    expect(prompt).toMatch(/git log/i);
    expect(prompt).not.toMatch(/set `created` to the earliest date the file mentions/);
  });
});

// #10: reflect semantic distinction — info stored vs tasks captured.
describe("process-conversation semantic distinction", () => {
  it("distinguishes information stored from tasks captured", () => {
    const prompt = readFileSync(
      join(bundledPromptsDir(), "process-conversation.md"),
      "utf8",
    );
    expect(prompt).toMatch(/information stored/i);
    expect(prompt).toMatch(/tasks captured/i);
  });
});
