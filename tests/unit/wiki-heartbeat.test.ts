// tests/unit/wiki-heartbeat.test.ts — FR-WIKI-05 heartbeat wiki audit.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WIKI_DIR } from "../../shared/brain-paths";
import { toLocalIsoStamp } from "../../shared/dates";
import { defaultWikiState } from "../../shared/wiki-state";
import { evaluateWikiHealth } from "../../backends/wiki-heartbeat";
import { formatWikiPage } from "../../backends/wiki-format";
import { regenerateWikiIndex } from "../../backends/wiki-index";
import { initTestGitRepo } from "../support/test-git";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "wiki-heartbeat-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function wikiJoin(...parts: string[]): string {
  return join(root, WIKI_DIR, ...parts);
}

function writePage(relPath: string): void {
  mkdirSync(join(wikiJoin(relPath), ".."), { recursive: true });
  writeFileSync(
    wikiJoin(relPath),
    formatWikiPage({
      title: "Alpha",
      summary: "Alpha summary.",
      tags: ["concepts"],
      created: "2026-08-01",
      updated: "2026-08-01",
      keyPoints: ["One", "Two", "Three", "Four", "Five"],
    }),
    "utf8",
  );
}

describe("evaluateWikiHealth", () => {
  it("skips when no wiki changes since last check", async () => {
    writePage("concepts/alpha.md");
    regenerateWikiIndex(root);

    const state = {
      ...defaultWikiState(),
      lastHealthCheck: "2026-08-11T00:00:00.000Z",
      pagesAtLastCheck: 1,
    };

    const result = await evaluateWikiHealth(
      root,
      state,
      "en",
      new Date("2026-08-11T01:00:00.000Z"),
      async () => false,
    );

    expect(result.ran).toBe(false);
    expect(result.state).toEqual(state);
  });

  it("runs check and updates state when wiki changed", async () => {
    await initTestGitRepo(root);
    writePage("concepts/alpha.md");
    writeFileSync(
      wikiJoin("concepts/beta.md"),
      formatWikiPage({
        title: "Beta",
        summary: "Beta.",
        tags: ["concepts"],
        created: "2026-08-01",
        updated: "2026-08-01",
        keyPoints: ["One", "Two", "Three", "Four", "Five"],
      }),
      "utf8",
    );
    regenerateWikiIndex(root);

    writePage("concepts/alpha.md");
    writeFileSync(
      wikiJoin("concepts/alpha.md"),
      formatWikiPage({
        title: "Alpha",
        summary: "Alpha summary.",
        tags: ["concepts"],
        created: "2026-08-01",
        updated: "2026-08-01",
        keyPoints: ["One", "Two", "Three", "Four", "Five"],
        connections: [{ path: "beta.md", description: "link" }],
      }),
      "utf8",
    );

    const now = new Date(2026, 7, 11, 3, 0);
    const result = await evaluateWikiHealth(
      root,
      defaultWikiState(),
      "en",
      now,
      async () => true,
    );

    expect(result.ran).toBe(true);
    expect(result.state.lastHealthCheck).toBe(toLocalIsoStamp(now));
    expect(result.state.pagesAtLastCheck).toBe(2);
    expect(result.repairs?.backlinksAdded).toBeGreaterThanOrEqual(1);

    const beta = readFileSync(wikiJoin("concepts/beta.md"), "utf8");
    expect(beta).toContain("alpha.md");
  });

  it("updates timestamp for empty wiki without running repairs", async () => {
    const now = new Date(2026, 7, 11, 4, 0);
    const hasChanges = vi.fn(async () => true);
    const result = await evaluateWikiHealth(root, defaultWikiState(), "en", now, hasChanges);

    expect(result.ran).toBe(false);
    expect(result.state.lastHealthCheck).toBe(toLocalIsoStamp(now));
    expect(hasChanges).not.toHaveBeenCalled();
  });
});
