// tests/unit/brain-migration.test.ts — FR-BRAIN-08: USER.md section scaffolding.

import { describe, expect, it } from "vitest";
import { ensureUserMdSections } from "../../backends/brain-migration";

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

  it("returns content unchanged when Preferences exists", () => {
    const result = ensureUserMdSections(WITH_PREFERENCES);
    expect(result).toBe(WITH_PREFERENCES);
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
  });
});
