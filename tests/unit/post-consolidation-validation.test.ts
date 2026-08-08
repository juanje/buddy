// tests/unit/post-consolidation-validation.test.ts — FR-GUARD-03 unit tests.

import { describe, expect, it } from "vitest";

import {
  findBrokenLinks,
  isValidBrainFilename,
  slugifyFilename,
  stripBrokenLink,
} from "../../backends/post-consolidation-validation";

describe("isValidBrainFilename", () => {
  it("accepts lowercase kebab paths", () => {
    expect(isValidBrainFilename("agent_brain/concepts/valid-name.md")).toBe(true);
  });

  it("rejects spaces and uppercase", () => {
    expect(isValidBrainFilename("agent_brain/concepts/Bad Name.md")).toBe(false);
    expect(isValidBrainFilename("agent_brain/concepts/MyConcept.md")).toBe(false);
  });
});

describe("slugifyFilename", () => {
  it("lowercases and hyphenates", () => {
    expect(slugifyFilename("agent_brain/concepts/My Bad Name.md")).toBe(
      "agent_brain/concepts/my-bad-name.md",
    );
    expect(slugifyFilename("agent_brain/concepts/MyConcept.md")).toBe(
      "agent_brain/concepts/myconcept.md",
    );
  });
});

describe("findBrokenLinks", () => {
  const root = "/tmp/root";

  it("finds missing relative targets", () => {
    const content = "See [missing](ghost.md) for details.";
    const broken = findBrokenLinks(content, "agent_brain/concepts/index.md", root);
    expect(broken).toHaveLength(1);
    expect(broken[0]?.display).toBe("missing");
    expect(broken[0]?.target).toBe("ghost.md");
  });

  it("ignores external links", () => {
    const content = "See [site](https://example.com) for details.";
    expect(findBrokenLinks(content, "agent_brain/concepts/index.md", root)).toHaveLength(0);
  });
});

describe("stripBrokenLink", () => {
  it("removes link syntax and keeps display text", () => {
    const content = "See [missing](ghost.md) here.";
    const [link] = findBrokenLinks(content, "agent_brain/x.md", "/tmp/root");
    expect(link).toBeDefined();
    expect(stripBrokenLink(content, link!)).toBe("See missing here.");
  });
});
