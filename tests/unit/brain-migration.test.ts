// tests/unit/brain-migration.test.ts — FR-BRAIN-08: USER.md section scaffolding; FR-PROMPT-08: AGENTS.md migration.

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
