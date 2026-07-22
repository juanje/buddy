// tests/unit/create-ab.test.ts — FR-SETUP-08 USER.md population.

import { describe, expect, it } from "vitest";

import { buildUserProfile } from "../../backends/create-ab";

describe("buildUserProfile", () => {
  it("writes real content with no template prose", () => {
    const md = buildUserProfile({
      rootDir: "/tmp/ab",
      provider: "anthropic",
      model: "claude-haiku-4-5",
      language: "en",
      name: "Alex",
      about: "Product designer",
    });
    expect(md).toContain("**Name:** Alex");
    expect(md).toContain("Product designer");
    expect(md).toContain("Language: en");
    expect(md).not.toContain("This section grows organically");
  });

  it("uses defaults when about is empty", () => {
    const md = buildUserProfile({
      rootDir: "/tmp/ab",
      provider: "openai",
      model: "gpt-4o-mini",
      name: "Sam",
    });
    expect(md).toContain("(to be discovered)");
    expect(md).toContain("Language: es");
  });
});
