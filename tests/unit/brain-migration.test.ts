// tests/unit/brain-migration.test.ts — FR-BRAIN-08: USER.md section scaffolding; FR-PROMPT-08: AGENTS.md migration.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  AGENTS_MD_BACKUP_REL,
  extractInstanceRules,
  isCoreRule,
  isOldAgentsMdFormat,
  migrateAgentsMdContent,
  migrateAgentsMdIfNeeded,
  migrateAgentsTasksReference,
  migrateInboxToTasksIfNeeded,
  ensureUserMdSections,
} from "../../backends/brain-migration";

const MINIMAL_USER_MD = `# User profile

## About

- **Name:** Juanje
- **What you do:** Software engineer

## Context

Using buddy for personal knowledge management.
`;

const WITH_PREFERENCES = `# User profile

## About

- **Name:** Juanje

## Preferences

Chat language: Spanish.

## Context

Some context.
`;

const WITH_BOTH = `# User profile

## About

- **Name:** Juanje

## Preferences

Chat language: Spanish.

## Principles

Values iterative feedback loops.

## Context

Some context.
`;

describe("ensureUserMdSections", () => {
  it("appends ## Preferences when missing", () => {
    const result = ensureUserMdSections(MINIMAL_USER_MD);
    expect(result).toContain("## Preferences");
  });

  it("preserves original content", () => {
    const result = ensureUserMdSections(MINIMAL_USER_MD);
    expect(result).toContain("## About");
    expect(result).toContain("Juanje");
    expect(result).toContain("## Context");
    expect(result).toContain("personal knowledge management");
  });

  it("does not duplicate Preferences when already present", () => {
    const result = ensureUserMdSections(WITH_PREFERENCES);
    const count = (result.match(/## Preferences/g) ?? []).length;
    expect(count).toBe(1);
  });

  it("is idempotent — second call produces same output", () => {
    const first = ensureUserMdSections(MINIMAL_USER_MD);
    const second = ensureUserMdSections(first);
    expect(second).toBe(first);
  });

  it("handles empty content", () => {
    const result = ensureUserMdSections("");
    expect(result).toContain("## Preferences");
    expect(result).toContain("## Principles");
  });

  it("appends ## Principles when missing", () => {
    const result = ensureUserMdSections(MINIMAL_USER_MD);
    expect(result).toContain("## Principles");
  });

  it("returns content unchanged when both sections exist", () => {
    const result = ensureUserMdSections(WITH_BOTH);
    expect(result).toBe(WITH_BOTH);
  });

  it("adds Principles when only Preferences exists", () => {
    const result = ensureUserMdSections(WITH_PREFERENCES);
    expect(result).toContain("## Principles");
    expect(result).toContain("Chat language: Spanish.");
  });

  it("does not duplicate Principles when already present", () => {
    const result = ensureUserMdSections(WITH_BOTH);
    const count = (result.match(/## Principles/g) ?? []).length;
    expect(count).toBe(1);
  });
});

// FR-PROMPT-08: AGENTS.md structural migration.
describe("migrateAgentsMd", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  const OLD_AGENTS = `# Buddy

## Core behavior

1. **Listen and capture:** tasks → inbox

## Active context

### Right now
- **Scotland:** pending.

## Rules

1. **Language:** Reply in the user's language.
2. Don't read files preemptively — access on demand.
13. **Always use 24-hour time** for scheduling.
`;

  it("detects old format via ## Core behavior marker", () => {
    expect(isOldAgentsMdFormat(OLD_AGENTS)).toBe(true);
    expect(isOldAgentsMdFormat("# Buddy\n\n## Active context\n")).toBe(false);
  });

  it("strips core behavior and preserves instance rules", () => {
    const migrated = migrateAgentsMdContent(OLD_AGENTS);
    expect(migrated).not.toContain("## Core behavior");
    expect(migrated).toContain("Scotland");
    expect(migrated).toContain("Always use 24-hour time");
    expect(migrated).not.toMatch(/\*\*Language:\*\*/);
  });

  it("isCoreRule matches shipped prefixes only", () => {
    expect(isCoreRule("1. **Language:** Spanish")).toBe(true);
    expect(isCoreRule("13. **Always use 24-hour time**")).toBe(false);
  });

  it("extractInstanceRules filters core rules", () => {
    const rules = extractInstanceRules(`1. **Language:** x
2. Don't read files preemptively
13. **Custom rule** for this instance`);
    expect(rules).toHaveLength(1);
    expect(rules[0]).toContain("Custom rule");
  });

  it("migrateAgentsMdIfNeeded writes backup and rewrites AGENTS.md", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-agents-migrate-"));
    writeFileSync(join(dir, "AGENTS.md"), OLD_AGENTS);
    expect(migrateAgentsMdIfNeeded(dir)).toBe(true);
    expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).not.toContain("## Core behavior");
    expect(existsSync(join(dir, AGENTS_MD_BACKUP_REL))).toBe(true);
    expect(readFileSync(join(dir, AGENTS_MD_BACKUP_REL), "utf8")).toContain("## Core behavior");
  });

  it("migrateAgentsMdIfNeeded is idempotent on new format", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-agents-migrate-"));
    const newFormat = migrateAgentsMdContent(OLD_AGENTS);
    writeFileSync(join(dir, "AGENTS.md"), newFormat);
    expect(migrateAgentsMdIfNeeded(dir)).toBe(false);
    expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toBe(newFormat);
  });
});

describe("migrateInboxToTasksIfNeeded", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("extracts checkbox lines and marks first open per area", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-inbox-migrate-"));
    mkdirSync(join(dir, "user"), { recursive: true });
    writeFileSync(
      join(dir, "user", "inbox.md"),
      `# Inbox

## Next Actions
- [ ] First @work
- [ ] Second @work
- [ ] Home errand @home
`,
      "utf8",
    );
    expect(migrateInboxToTasksIfNeeded(dir)).toBe(true);
    expect(existsSync(join(dir, "user", "tasks.md"))).toBe(true);
    expect(existsSync(join(dir, "user", "inbox.md"))).toBe(false);
    expect(existsSync(join(dir, "user", "inbox.md.migrated"))).toBe(false);
    const tasks = readFileSync(join(dir, "user", "tasks.md"), "utf8");
    expect(tasks).toContain(">> First @work");
    expect(tasks).toContain("- [ ] Second @work");
    expect(tasks).toContain(">> Home errand @home");
  });

  it("creates empty tasks.md when inbox has no checkboxes", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-inbox-migrate-"));
    mkdirSync(join(dir, "user"), { recursive: true });
    writeFileSync(
      join(dir, "user", "inbox.md"),
      `# Inbox

## Capture
Notes without checkbox syntax.
`,
      "utf8",
    );
    expect(migrateInboxToTasksIfNeeded(dir)).toBe(true);
    expect(existsSync(join(dir, "user", "tasks.md"))).toBe(true);
    const tasks = readFileSync(join(dir, "user", "tasks.md"), "utf8");
    expect(tasks).toContain("# Tasks");
    expect(tasks).not.toMatch(/^- \[[ x]\]/m);
    expect(existsSync(join(dir, "user", "inbox.md"))).toBe(false);
  });

  it("is a no-op when tasks.md already exists", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-inbox-migrate-"));
    mkdirSync(join(dir, "user"), { recursive: true });
    writeFileSync(join(dir, "user", "inbox.md"), "- [ ] Keep\n", "utf8");
    writeFileSync(join(dir, "user", "tasks.md"), "- [ ] Existing\n", "utf8");
    expect(migrateInboxToTasksIfNeeded(dir)).toBe(false);
    expect(readFileSync(join(dir, "user", "tasks.md"), "utf8")).toContain("Existing");
  });
});

describe("migrateAgentsTasksReference", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  const inboxNav =
    "  - [Inbox](user/inbox.md) — GTD inbox: Capture, Next Actions, @context lists.";

  it("replaces inbox navigation line with tasks line", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-agents-tasks-nav-"));
    writeFileSync(
      join(dir, "AGENTS.md"),
      `# Buddy\n\n## Where to find things\n\n${inboxNav}\n`,
      "utf8",
    );
    expect(migrateAgentsTasksReference(dir)).toBe(true);
    const content = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(content).toContain("[Tasks](user/tasks.md)");
    expect(content).not.toContain("[Inbox](user/inbox.md)");
  });

  it("is a no-op when already migrated", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-agents-tasks-nav-"));
    const migrated = readFileSync(join(process.cwd(), "templates", "AGENTS.md"), "utf8");
    writeFileSync(join(dir, "AGENTS.md"), migrated, "utf8");
    expect(migrateAgentsTasksReference(dir)).toBe(false);
  });

  it("is a no-op when AGENTS.md has no inbox line", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-agents-tasks-nav-"));
    writeFileSync(join(dir, "AGENTS.md"), "# Buddy\n\n## Where to find things\n", "utf8");
    expect(migrateAgentsTasksReference(dir)).toBe(false);
  });

  it("replaces bare inbox.md references in customized content", () => {
    dir = mkdtempSync(join(tmpdir(), "buddy-agents-tasks-nav-"));
    writeFileSync(
      join(dir, "AGENTS.md"),
      `# Buddy

## Where to find things

  - [Tasks](user/tasks.md) — task list.
  - [Projects](user/projects/index.md) — mirrored in inbox.md @context lists.
`,
      "utf8",
    );
    expect(migrateAgentsTasksReference(dir)).toBe(true);
    const content = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(content).not.toMatch(/\binbox\.md\b/);
    expect(content).toContain("mirrored in tasks.md");
  });
});
