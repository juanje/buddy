// tests/unit/prompt.test.ts — system prompt and session context assembly.

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { assembleSessionContext, assembleSystemPrompt } from "../../backends/prompt";
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

  it("returns empty session context when nothing episodic applies", () => {
    ({ configDir: globalConfigDir } = setupGlobalConfigDir({ agentsBase: "# Base\n" }, vi));
    dir = mkdtempSync(join(tmpdir(), "buddy-prompt-"));
    mkdirSync(join(dir, "agent_brain", "identity"), { recursive: true });
    writeFileSync(
      join(dir, "agent_brain", "identity", "USER.md"),
      "# User\n\n- **Name:** Juanje\n",
    );

    const ctx = assembleSessionContext(dir, new Date("2026-07-22T12:00:00Z"));

    expect(ctx.message).toBe("");
    expect(ctx.personalizationPending).toBe(false);
  });
});
