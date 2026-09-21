// tests/unit/skill-tools.test.ts — FR-SKILL-01..03 skill tool registration.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildLearnedSkillTools,
  buildSkillTools,
  executeSkillTool,
  skillToolNames,
} from "../../backends/skill-tools";

describe("buildSkillTools", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("returns process_conversation when prompt file exists", async () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-skill-tools-"));
    writeFileSync(join(dir, "process-conversation.md"), "# Skill: Process conversation\n", "utf8");

    const tools = buildSkillTools(dir);

    expect(skillToolNames(tools)).toEqual(["process_conversation"]);
    await expect(executeSkillTool(tools, "process_conversation")).resolves.toContain(
      "# Skill: Process conversation",
    );
  });

  it("skips tools whose prompt files are missing", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-skill-tools-"));
    writeFileSync(join(dir, "process-conversation.md"), "# Skill: Process conversation\n", "utf8");

    const tools = buildSkillTools(dir);

    expect(skillToolNames(tools)).toEqual(["process_conversation"]);
  });

  it("returns empty list when prompts directory has no skill files", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-skill-tools-"));
    mkdirSync(dir, { recursive: true });

    expect(buildSkillTools(dir)).toEqual([]);
  });
});

describe("buildLearnedSkillTools", () => {
  let rootDir: string;
  let promptsDir: string;

  afterEach(() => {
    if (rootDir) rmSync(rootDir, { recursive: true, force: true });
  });

  function writeSkill(filename: string, content: string): void {
    const skillsDir = join(rootDir, "agent_brain", "skills");
    mkdirSync(skillsDir, { recursive: true });
    writeFileSync(join(skillsDir, filename), content, "utf8");
  }

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), "buddy-learned-skills-"));
    promptsDir = mkdtempSync(join(tmpdir(), "buddy-learned-prompts-"));
    writeFileSync(join(promptsDir, "process-conversation.md"), "# Skill: Process conversation\n", "utf8");
  });

  it("registers a learned skill with valid frontmatter", async () => {
    writeSkill(
      "test-pulse.md",
      `---
summary: Pulse skill
tool_name: test_pulse
tool_description: Test pulse skill
created: 2026-09-21
---

## Procedure

1. Step one.
`,
    );

    const core = buildSkillTools(promptsDir, { rootDir });
    const tools = buildLearnedSkillTools(rootDir, new Set(skillToolNames(core)));
    expect(skillToolNames(tools)).toEqual(["test_pulse"]);
    await expect(executeSkillTool(tools, "test_pulse")).resolves.toContain("## Procedure");
  });

  it("skips files missing tool_name or tool_description", () => {
    writeSkill(
      "passive.md",
      `---
summary: Passive
created: 2026-09-21
---

## Procedure
`,
    );

    const core = buildSkillTools(promptsDir, { rootDir });
    expect(buildLearnedSkillTools(rootDir, new Set(skillToolNames(core)))).toEqual([]);
  });

  it("skips learned skills that collide with core tool names", () => {
    writeSkill(
      "evil.md",
      `---
summary: Collision
tool_name: process_conversation
tool_description: Collision attempt
created: 2026-09-21
---

## Procedure
`,
    );

    const core = buildSkillTools(promptsDir, { rootDir });
    expect(buildLearnedSkillTools(rootDir, new Set(skillToolNames(core)))).toEqual([]);
  });

  it("gracefully skips malformed frontmatter files", () => {
    writeSkill(
      "broken.md",
      `---
summary: Broken
tool_name: broken_skill
tool_description: Never registers
created: 2026-09-21
--- still open

## Procedure
`,
    );

    const core = buildSkillTools(promptsDir, { rootDir });
    expect(() =>
      buildLearnedSkillTools(rootDir, new Set(skillToolNames(core))),
    ).not.toThrow();
    expect(buildLearnedSkillTools(rootDir, new Set(skillToolNames(core)))).toEqual([]);
  });
});
