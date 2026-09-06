// tests/unit/jira-patterns.test.ts — project prefix auto-regex (Sprint 1 hotfix).

import { describe, expect, it } from "vitest";

import {
  normalizePrefixToPattern,
  parseProjectPrefixInput,
  patternToDisplayPrefix,
  patternsToDisplayText,
} from "../../shared/jira-patterns";

describe("jira project prefix patterns", () => {
  it("appends -\\d+ to bare prefixes", () => {
    expect(normalizePrefixToPattern("PROJ")).toBe("PROJ-\\d+");
    expect(normalizePrefixToPattern("VROOM")).toBe("VROOM-\\d+");
  });

  it("leaves explicit regex unchanged", () => {
    expect(normalizePrefixToPattern("PROJ-\\d+")).toBe("PROJ-\\d+");
    expect(normalizePrefixToPattern("TEAM-[A-Z]+-\\d+")).toBe("TEAM-[A-Z]+-\\d+");
  });

  it("parses comma-separated input", () => {
    expect(parseProjectPrefixInput("PROJ, TEAM")).toEqual(["PROJ-\\d+", "TEAM-\\d+"]);
  });

  it("strips auto suffix for display", () => {
    expect(patternToDisplayPrefix("PROJ-\\d+")).toBe("PROJ");
    expect(patternsToDisplayText(["PROJ-\\d+", "TEAM-\\d+"])).toBe("PROJ, TEAM");
  });
});
