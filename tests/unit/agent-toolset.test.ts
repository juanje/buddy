// tests/unit/agent-toolset.test.ts — what a live session is actually given.
//
// `show_file` (FR-CHAT-17) can be correct and never reachable. Its own tests
// drive `buildShowFileTools` directly, which says nothing about whether a user
// session ever registers it — the same shape as the Hebbian layer, which passed
// its unit tests for months while recording nothing because no test drove the
// real flow.
//
// The second check is the one that would have caught a mistake in this very
// change. `createAgentSession` takes `tools` (names offered to the model) and
// `customTools` (implementations) as two lists. A tool present in one and
// missing from the other is not an error anywhere: it is simply never called,
// which is indistinguishable from a model that chose not to call it.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildAgentToolset } from "../../backends/session-boot";
import { AGENT_TOOLS, EXCLUDED_TOOLS } from "../../shared/defaults";
import { setupGlobalConfigDir, teardownGlobalConfigDir } from "../support/global-config";

let root: string;

beforeEach(() => {
  setupGlobalConfigDir();
  root = mkdtempSync(join(tmpdir(), "buddy-toolset-"));
});

afterEach(() => {
  teardownGlobalConfigDir();
  rmSync(root, { recursive: true, force: true });
});

function toolset() {
  return buildAgentToolset(root, {
    requestPermission: async () => true,
    showFile: () => {},
  });
}

describe("the toolset a user session is given", () => {
  it("offers show_file to the model", () => {
    expect(toolset().names).toContain("show_file");
  });

  it("offers wiki_search and wiki_file to the model", () => {
    const { names } = toolset();
    expect(names).toContain("wiki_search");
    expect(names).toContain("wiki_file");
  });

  it("registers implementations for wiki tools", () => {
    const custom = toolset().customTools.map((tool) => tool.name);
    expect(custom).toContain("wiki_search");
    expect(custom).toContain("wiki_file");
  });

  it("registers an implementation for show_file", () => {
    expect(toolset().customTools.map((tool) => tool.name)).toContain("show_file");
  });

  it("offers every custom tool it registers, and registers every one it offers", () => {
    const { names, customTools } = toolset();
    const custom = customTools.map((tool) => tool.name).sort();
    const offeredCustom = names.filter((name) => !AGENT_TOOLS.includes(name as never)).sort();
    expect(offeredCustom).toEqual(custom);
  });

  it("keeps the built-in file tools and leaves bash out", () => {
    const { names } = toolset();
    for (const builtin of AGENT_TOOLS) expect(names).toContain(builtin);
    for (const excluded of EXCLUDED_TOOLS) expect(names).not.toContain(excluded);
  });

  it("names no tool twice", () => {
    const { names } = toolset();
    expect(new Set(names).size).toBe(names.length);
  });
});
