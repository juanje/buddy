// tests/unit/reflect-right-now.test.ts — FR-REFLECT-11.
//
// Reflect fork has no tools, so it cannot edit AGENTS.md. It emits
// `### Right now patches` with the complete updated Right now body; the
// worker extracts that section and replaces `### Right now` in the current
// AGENTS.md (read at patch time, not session start).

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { extractRightNowPatches } from "../../backends/reflect-prompts";
import { applyRightNowPatches } from "../../backends/reflect";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "reflect-rn-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const WITH_PATCHES = `### Context

Shipped v0.1.46.

### Right now patches

- **Buddy v0.1.46 shipped** — FR-REFLECT-11 on main.
- **Next:** Phase 3 team workspace.

### Open threads

Tag the release.
`;

const AGENTS_TEMPLATE = `# Buddy

## Active context

### Right now

- **Buddy v0.1.45 shipped** — stale.

### Files

Promotion is gradual — keep this paragraph.

## Where to find things

- [Tasks](user/tasks.md)
`;

describe("extractRightNowPatches", () => {
  it("separates the Right now patches from the log body", () => {
    const { body, rightNowPatches } = extractRightNowPatches(WITH_PATCHES);

    expect(rightNowPatches).toContain("Buddy v0.1.46 shipped");
    expect(rightNowPatches).toContain("Phase 3 team workspace");
    expect(body).not.toContain("### Right now patches");
    expect(body).toContain("### Context");
    expect(body).toContain("### Open threads");
  });

  it("leaves output without the section untouched", () => {
    const plain = "### Context\n\nNothing notable.\n";
    const { body, rightNowPatches } = extractRightNowPatches(plain);
    expect(body).toBe(plain);
    expect(rightNowPatches).toBeUndefined();
  });

  it("handles the section appearing last", () => {
    const { body, rightNowPatches } = extractRightNowPatches(
      "### Context\n\nSomething.\n\n### Right now patches\n\n- Status flipped.\n",
    );
    expect(rightNowPatches).toContain("Status flipped");
    expect(body.trim()).toBe("### Context\n\nSomething.");
  });

  it("ignores an empty section rather than patching nothing", () => {
    const { rightNowPatches } = extractRightNowPatches(
      "### Context\n\nSomething.\n\n### Right now patches\n\n\n### Open threads\n\nx\n",
    );
    expect(rightNowPatches).toBeUndefined();
  });

  it("does not treat ### Right now as the patches heading", () => {
    const log = "### Right now\n\nThis belongs in the log, not AGENTS.md.\n";
    const { body, rightNowPatches } = extractRightNowPatches(log);
    expect(rightNowPatches).toBeUndefined();
    expect(body).toBe(log);
  });
});

describe("applyRightNowPatches", () => {
  it("replaces the Right now body and preserves the rest of AGENTS.md", () => {
    writeFileSync(join(root, "AGENTS.md"), AGENTS_TEMPLATE, "utf8");

    applyRightNowPatches(
      root,
      "- **Buddy v0.1.46 shipped** — FR-REFLECT-11 on main.\n- **Next:** Phase 3.",
    );

    const content = readFileSync(join(root, "AGENTS.md"), "utf8");
    expect(content).toContain("Buddy v0.1.46 shipped");
    expect(content).not.toContain("stale");
    expect(content).toContain("Promotion is gradual — keep this paragraph.");
    expect(content).toContain("[Tasks](user/tasks.md)");
    expect(content).toMatch(/### Right now\n/);
    expect(content).toContain("### Files");
  });

  it("does not create AGENTS.md when the instance has none", () => {
    applyRightNowPatches(root, "- A change.");
    expect(existsSync(join(root, "AGENTS.md"))).toBe(false);
  });

  it("does not write when there is no Right now heading", () => {
    const original = "# Buddy\n\n## Rules\n\nKeep going.\n";
    writeFileSync(join(root, "AGENTS.md"), original, "utf8");
    applyRightNowPatches(root, "- A change.");
    expect(readFileSync(join(root, "AGENTS.md"), "utf8")).toBe(original);
  });

  it("does not write when patches are empty or missing", () => {
    writeFileSync(join(root, "AGENTS.md"), AGENTS_TEMPLATE, "utf8");
    applyRightNowPatches(root, undefined);
    applyRightNowPatches(root, "   \n");
    expect(readFileSync(join(root, "AGENTS.md"), "utf8")).toBe(AGENTS_TEMPLATE);
  });
});
