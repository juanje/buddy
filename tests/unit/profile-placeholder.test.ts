// tests/unit/profile-placeholder.test.ts — FR-PROMPT-05.
//
// The detector decided whether to inject the first-conversation setup
// interview. It looked for a literal `**Name:**` line:
//
//     const nameLine = userMd.split("\n").find((l) => l.includes("**Name:**"));
//     if (!nameLine) return true;
//
// An instance whose profile had grown to say `- **Full name:** Juan Jesús …`
// therefore reported "placeholder" on every single session, and Buddy injected
// a block that opens "This is your first conversation together" and instructs
// the model to **rewrite USER.md completely**.
//
// Observed 2026-07-29: an assistant with a 200-line profile of the user told
// them it needed to run setup, and earlier runs had rewritten the profile
// because the injected block told them to. The model was following
// instructions exactly.
//
// The replacement compares against the template we ship. That is the only
// definition that does not depend on a formatting convention the agent is free
// to change — and the agent does change it, because the profile is meant to
// grow.

import { describe, expect, it } from "vitest";

import { isUserProfilePlaceholder } from "../../backends/prompt";

const TEMPLATE = `# User profile

## About

- **Name:**
- **What you do:**

This section grows organically from conversation — interests, how you like to work, what matters to you.

## Context

What are you using this system for? Permanent facts about your situation go here.

## Preferences

How do you like to work? How should the agent present information?
`;

describe("isUserProfilePlaceholder", () => {
  it("treats a missing profile as unpersonalized", () => {
    expect(isUserProfilePlaceholder(undefined, TEMPLATE)).toBe(true);
  });

  it("treats the untouched template as unpersonalized", () => {
    expect(isUserProfilePlaceholder(TEMPLATE, TEMPLATE)).toBe(true);
  });

  it("ignores whitespace and trailing-newline differences", () => {
    // Deploying the template through different code paths can vary these, and
    // a spurious newline must not read as "the user filled this in".
    expect(isUserProfilePlaceholder(`${TEMPLATE.trimEnd()}\n\n\n`, TEMPLATE)).toBe(true);
    expect(isUserProfilePlaceholder(TEMPLATE.replace(/\n/g, "\r\n"), TEMPLATE)).toBe(true);
  });

  it("treats an empty or whitespace-only file as unpersonalized", () => {
    expect(isUserProfilePlaceholder("", TEMPLATE)).toBe(true);
    expect(isUserProfilePlaceholder("   \n\n  ", TEMPLATE)).toBe(true);
  });

  it("recognises a profile the wizard filled in", () => {
    const filled = TEMPLATE.replace("- **Name:**", "- **Name:** Ana");
    expect(isUserProfilePlaceholder(filled, TEMPLATE)).toBe(false);
  });

  // The regression that prompted this. The key was renamed as the profile grew.
  it("recognises a profile whose name key was renamed", () => {
    const grown = `# User profile

## About

- **Full name:** Juan Jesús Ojeda Croissier (goes by Juanje)
- **Location:** Las Palmas de Gran Canaria

## Key people

Pedro, Alberto, Israel.
`;
    expect(isUserProfilePlaceholder(grown, TEMPLATE)).toBe(false);
  });

  it("recognises a profile written in another language", () => {
    // Nothing requires the agent to keep English key names in a Spanish
    // instance, and the old detector would have failed here too.
    expect(
      isUserProfilePlaceholder("# Perfil\n\n- **Nombre:** Ana\n- **Vive en:** Madrid\n", TEMPLATE),
    ).toBe(false);
  });

  it("recognises a profile with no headings at all", () => {
    expect(isUserProfilePlaceholder("Ana, 34, lives in Madrid.\n", TEMPLATE)).toBe(false);
  });

  it("falls back to non-placeholder when the template cannot be read", () => {
    // Erring towards "personalized" is the safe direction: the cost of a
    // missed interview is one absent question, while a false interview tells a
    // user the assistant does not know them and orders their profile rewritten.
    expect(isUserProfilePlaceholder("Some real profile content.\n", undefined)).toBe(false);
  });

  it("still reports a missing profile as placeholder without a template", () => {
    expect(isUserProfilePlaceholder(undefined, undefined)).toBe(true);
    expect(isUserProfilePlaceholder("  \n", undefined)).toBe(true);
  });
});
