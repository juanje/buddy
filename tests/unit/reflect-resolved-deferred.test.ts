// tests/unit/reflect-resolved-deferred.test.ts — FR-DEFERRED-06.
//
// Deferred items surfaced at session start (FR-DEFERRED-01) can be resolved
// during the conversation — the user acts on a decision or reminder, and
// nobody removes it from deferred.md. It keeps resurfacing at every
// subsequent boot and heartbeat.
//
// Same division of labour as observations (FR-REFLECT-08) and Right now
// patches (FR-REFLECT-11): the reflect fork has no tools, so it cannot edit
// deferred.md directly. It emits a `### Resolved deferred` section instead;
// the worker extracts it and removes the matching entries.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { extractResolvedDeferred } from "../../backends/reflect-prompts";
import { removeResolvedDeferredItems } from "../../backends/deferred";

const WITH_RESOLVED = `### Context

The user grouped their laptop tasks into a project.

### Resolved deferred

- Group laptop tasks into a project?
- Review verify comment handling in Buddy

### Decisions

Decided to simplify cleanup.
`;

describe("extractResolvedDeferred", () => {
  it("separates the resolved deferred section from the log body", () => {
    const { body, resolvedDeferred } = extractResolvedDeferred(WITH_RESOLVED);

    expect(resolvedDeferred).toContain("Group laptop tasks into a project?");
    expect(resolvedDeferred).toContain("Review verify comment handling in Buddy");
    expect(body).not.toContain("### Resolved deferred");
    expect(body).toContain("### Context");
    expect(body).toContain("### Decisions");
  });

  it("leaves output without the section untouched", () => {
    const plain = "### Context\n\nNothing notable.\n";
    const { body, resolvedDeferred } = extractResolvedDeferred(plain);
    expect(body).toBe(plain);
    expect(resolvedDeferred).toBeUndefined();
  });

  it("handles the section appearing last", () => {
    const { body, resolvedDeferred } = extractResolvedDeferred(
      "### Context\n\nSomething.\n\n### Resolved deferred\n\n- An item.\n",
    );
    expect(resolvedDeferred).toContain("An item");
    expect(body.trim()).toBe("### Context\n\nSomething.");
  });

  it("ignores an empty section rather than resolving nothing", () => {
    const { resolvedDeferred } = extractResolvedDeferred(
      "### Context\n\nSomething.\n\n### Resolved deferred\n\n\n### Decisions\n\nx\n",
    );
    expect(resolvedDeferred).toBeUndefined();
  });
});

describe("removeResolvedDeferredItems", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "reflect-resolved-deferred-"));
    mkdirSync(join(root, "agent_brain"), { recursive: true });
    writeFileSync(
      join(root, "agent_brain", "deferred.md"),
      [
        "# Deferred queue",
        "",
        "- **decision** (2026-09-14, daily): Group laptop tasks into a project?",
        "- **reminder** (2026-09-14, user): Review verify comment handling in Buddy.",
        "- **decision** (2026-09-15, weekly): Prioritize @general fronts.",
        "",
      ].join("\n"),
      "utf8",
    );
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("removes matching entries by description text, keeps the rest", () => {
    const removed = removeResolvedDeferredItems(
      root,
      "- Group laptop tasks into a project?\n- Review verify comment handling in Buddy",
    );

    const content = readFileSync(join(root, "agent_brain", "deferred.md"), "utf8");
    expect(removed).toBe(2);
    expect(content).not.toContain("Group laptop tasks");
    expect(content).not.toContain("verify comment handling");
    expect(content).toContain("Prioritize @general fronts.");
    expect(content).toContain("# Deferred queue");
  });

  it("matches the session-context injection format ([type] due date (source): text)", () => {
    const removed = removeResolvedDeferredItems(
      root,
      "- [decision] due 2026-09-14 (daily): Group laptop tasks into a project?",
    );

    const content = readFileSync(join(root, "agent_brain", "deferred.md"), "utf8");
    expect(removed).toBe(1);
    expect(content).not.toContain("Group laptop tasks");
    expect(content).toContain("Review verify comment handling");
  });

  it("preserves entries that do not match any resolved line", () => {
    const removed = removeResolvedDeferredItems(root, "- Something unrelated that never appeared");

    const content = readFileSync(join(root, "agent_brain", "deferred.md"), "utf8");
    expect(removed).toBe(0);
    expect(content).toContain("Group laptop tasks");
    expect(content).toContain("verify comment handling");
    expect(content).toContain("Prioritize @general fronts.");
  });

  it("handles a missing deferred.md gracefully", () => {
    rmSync(join(root, "agent_brain", "deferred.md"));
    expect(removeResolvedDeferredItems(root, "- Group laptop tasks into a project?")).toBe(0);
  });

  it("returns 0 when the resolved text has no usable lines", () => {
    expect(removeResolvedDeferredItems(root, "")).toBe(0);
    expect(removeResolvedDeferredItems(root, "   \n  ")).toBe(0);
  });
});
