// tests/unit/post-consolidation-validation.test.ts — FR-GUARD-03 unit tests.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  findBrokenLinks,
  isValidBrainFilename,
  slugifyFilename,
  stripBrokenLink,
} from "../../backends/post-consolidation-validation";

const tmpRoots: string[] = [];

afterEach(() => {
  while (tmpRoots.length > 0) rmSync(tmpRoots.pop()!, { recursive: true, force: true });
});

function liveRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "buddy-pcv-"));
  tmpRoots.push(root);
  mkdirSync(join(root, "agent_brain", "concepts"), { recursive: true });
  return root;
}

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
  it("finds missing relative targets", () => {
    const root = liveRoot();
    const content = "See [missing](ghost.md) for details.";
    const broken = findBrokenLinks(content, "agent_brain/concepts/index.md", root);
    expect(broken).toHaveLength(1);
    expect(broken[0]?.display).toBe("missing");
    expect(broken[0]?.target).toBe("ghost.md");
  });

  it("ignores external links", () => {
    const root = liveRoot();
    const content = "See [site](https://example.com) for details.";
    expect(findBrokenLinks(content, "agent_brain/concepts/index.md", root)).toHaveLength(0);
  });

  it("ignores escape links outside the buddy root (review D7)", () => {
    const root = liveRoot();
    writeFileSync(join(root, "agent_brain", "concepts", "index.md"), "# idx\n");
    const content = "See [escape](../../../../Windows/System32/drivers/etc/hosts) out.";
    expect(findBrokenLinks(content, "agent_brain/concepts/index.md", root)).toHaveLength(0);
  });
});

describe("stripBrokenLink", () => {
  it("removes link syntax and keeps display text", () => {
    const root = liveRoot();
    const content = "See [missing](ghost.md) here.";
    const [link] = findBrokenLinks(content, "agent_brain/x.md", root);
    expect(link).toBeDefined();
    expect(stripBrokenLink(content, link!)).toBe("See missing here.");
  });
});
