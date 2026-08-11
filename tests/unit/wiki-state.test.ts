// tests/unit/wiki-state.test.ts — wiki-state.json load/save (FR-WIKI-05).

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import { WIKI_STATE_PATH } from "../../shared/defaults";
import {
  defaultWikiState,
  loadWikiState,
  saveWikiState,
} from "../../shared/wiki-state";

describe("wiki-state", () => {
  let root: string;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("returns defaults when file is missing", () => {
    root = mkdtempSync(join(tmpdir(), "wiki-state-"));
    expect(loadWikiState(root)).toEqual(defaultWikiState());
  });

  it("returns defaults when file is corrupt", () => {
    root = mkdtempSync(join(tmpdir(), "wiki-state-"));
    mkdirSync(join(root, ".buddy"), { recursive: true });
    writeFileSync(join(root, WIKI_STATE_PATH), "{not json", "utf8");
    expect(loadWikiState(root)).toEqual(defaultWikiState());
  });

  it("round-trips save and load", () => {
    root = mkdtempSync(join(tmpdir(), "wiki-state-"));
    const state = {
      ...defaultWikiState(),
      lastHealthCheck: "2026-08-11T00:00:00.000Z",
      pagesAtLastCheck: 12,
    };
    saveWikiState(root, state);
    expect(existsSync(join(root, WIKI_STATE_PATH))).toBe(true);
    expect(loadWikiState(root)).toEqual(state);
    const raw = readFileSync(join(root, WIKI_STATE_PATH), "utf8");
    expect(raw.endsWith("\n")).toBe(true);
  });
});
