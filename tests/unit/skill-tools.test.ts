// tests/unit/skill-tools.test.ts — FR-SKILL-01..03 skill tool registration.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildSkillTools,
  executeSkillTool,
  skillToolNames,
} from "../../backends/skill-tools";

describe("buildSkillTools", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("returns both skill tools when prompt files exist", async () => {
    dir = mkdtempSync(join(tmpdir(), "ab-skill-tools-"));
    writeFileSync(join(dir, "process-conversation.md"), "# Skill: Process conversation\n", "utf8");
    writeFileSync(join(dir, "triage-inbox.md"), "# Skill: Triage inbox\n", "utf8");

    const tools = buildSkillTools(dir);

    expect(skillToolNames(tools)).toEqual(["process_conversation", "triage_inbox"]);
    await expect(executeSkillTool(tools, "process_conversation")).resolves.toContain(
      "# Skill: Process conversation",
    );
    await expect(executeSkillTool(tools, "triage_inbox")).resolves.toContain(
      "# Skill: Triage inbox",
    );
  });

  it("skips tools whose prompt files are missing", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-skill-tools-"));
    writeFileSync(join(dir, "process-conversation.md"), "# Skill: Process conversation\n", "utf8");

    const tools = buildSkillTools(dir);

    expect(skillToolNames(tools)).toEqual(["process_conversation"]);
  });

  it("returns empty list when prompts directory has no skill files", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-skill-tools-"));
    mkdirSync(dir, { recursive: true });

    expect(buildSkillTools(dir)).toEqual([]);
  });
});
