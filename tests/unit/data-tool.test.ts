// tests/unit/data-tool.test.ts — FR-DATA-02

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { executeDataAction } from "../../backends/data/data-tool-actions";
import { countRegistrySectionsNamed } from "../../shared/data/registry";

describe("executeDataAction", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("help mentions series define and list", () => {
    dir = mkdtempSync(join(tmpdir(), "data-tool-"));
    const out = executeDataAction(dir, "help");
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.text).toMatch(/define/);
      expect(out.text).toMatch(/list/);
      expect(out.text).toMatch(/series/);
      expect(out.text).toMatch(/sections/);
    }
  });

  it("define registers a series entry and list shows inactive mode", () => {
    dir = mkdtempSync(join(tmpdir(), "data-tool-"));
    const def = executeDataAction(dir, "define", {
      name: "migraines",
      kind: "series",
      key: "date,time",
      column_date: "date",
      column_time: "string",
      column_intensity: "number",
      mode: "on_mention",
    });
    expect(def.ok).toBe(true);
    const list = executeDataAction(dir, "list");
    expect(list.ok).toBe(true);
    if (list.ok) {
      expect(list.text).toContain("migraines");
      expect(list.text).toContain("user/data/migraines.csv");
      expect(list.text).toContain("inactive until sprint 6");
    }
  });

  it("define accepts a columns map and a key list without creating the csv", () => {
    dir = mkdtempSync(join(tmpdir(), "data-tool-"));
    const out = executeDataAction(dir, "define", {
      name: "migranas",
      kind: "series",
      key: ["fecha", "hora"],
      columns: { fecha: "date", hora: "string", intensidad: "number" },
    });
    expect(out.ok).toBe(true);
    expect(existsSync(join(dir, "user/data/index.md"))).toBe(true);
    expect(existsSync(join(dir, "user/data/migranas.csv"))).toBe(false);
    const list = executeDataAction(dir, "list");
    expect(list.ok).toBe(true);
    if (list.ok) expect(list.text).toContain("migranas");
  });

  it("help shows the columns map and that define does not create the csv", () => {
    dir = mkdtempSync(join(tmpdir(), "data-tool-"));
    const out = executeDataAction(dir, "help");
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.text).toContain("columns:");
      expect(out.text).toContain("does not create the CSV");
    }
  });

  it("define sections kind is refused without creating index", () => {
    dir = mkdtempSync(join(tmpdir(), "data-tool-"));
    const out = executeDataAction(dir, "define", {
      name: "notes",
      kind: "sections",
      path: "user/data/notes.md",
      key: "id",
      column_id: "string",
    });
    expect(out.ok).toBe(false);
    expect(existsSync(join(dir, "user/data/index.md"))).toBe(false);
  });

  it("define snapshot mode is refused", () => {
    dir = mkdtempSync(join(tmpdir(), "data-tool-"));
    const out = executeDataAction(dir, "define", {
      name: "daily",
      kind: "series",
      key: "date",
      column_date: "date",
      mode: "snapshot",
    });
    expect(out.ok).toBe(false);
  });

  it("define rejects reserved column origin", () => {
    dir = mkdtempSync(join(tmpdir(), "data-tool-"));
    const out = executeDataAction(dir, "define", {
      name: "bad",
      kind: "series",
      key: "origin",
      column_origin: "string",
    });
    expect(out.ok).toBe(false);
  });

  it("define replaces an existing entry name", () => {
    dir = mkdtempSync(join(tmpdir(), "data-tool-"));
    executeDataAction(dir, "define", {
      name: "episodes",
      kind: "series",
      key: "id",
      column_id: "string",
      instructions: "First version",
    });
    executeDataAction(dir, "define", {
      name: "episodes",
      kind: "series",
      key: "id",
      column_id: "string",
      instructions: "Second version",
    });
    const text = readFileSync(join(dir, "user/data/index.md"), "utf8");
    expect(text).toContain("Second version");
    expect(text).not.toContain("First version");
    expect(countRegistrySectionsNamed(text, "episodes")).toBe(1);
  });

  it("list without registry file does not create one", () => {
    dir = mkdtempSync(join(tmpdir(), "data-tool-"));
    const out = executeDataAction(dir, "list");
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.text).toMatch(/No entries/);
    expect(existsSync(join(dir, "user/data/index.md"))).toBe(false);
  });
});
