// tests/unit/on-mention-session-context.test.ts — FR-DATA-04

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { assembleSessionContext } from "../../backends/prompt";
import { executeDataAction } from "../../backends/data/data-tool-actions";
import { formatOnMentionSessionSection } from "../../shared/data/on-mention-session";
import type { DataRegistryEntry } from "../../shared/data/registry";

describe("formatOnMentionSessionSection", () => {
  it("joins two on mention entries on one line with instructions", () => {
    const entries: DataRegistryEntry[] = [
      {
        name: "migranas",
        path: "user/data/migranas.csv",
        kind: "series",
        key: ["fecha", "hora"],
        columns: { fecha: "date", hora: "string", intensidad: "number" },
        mode: "on_mention",
        inferred: false,
        sensitive: false,
        instructions: "One row per episode.",
      },
      {
        name: "incidents",
        path: "user/data/incidents.csv",
        kind: "series",
        key: "id",
        columns: { id: "string", note: "string" },
        mode: "on_mention",
        inferred: false,
        sensitive: false,
        instructions: "Log each incident.",
      },
    ];
    const section = formatOnMentionSessionSection(entries);
    expect(section).toContain("# Active data to record on mention");
    expect(section).toMatch(/migranas \(user\/data\/migranas\.csv\) — One row per episode\./);
    expect(section).toMatch(/incidents \(user\/data\/incidents\.csv\) — Log each incident\./);
  });
});

describe("assembleSessionContext on_mention", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("includes on mention entries and list drops inactive suffix", () => {
    dir = mkdtempSync(join(tmpdir(), "on-mention-"));
    const def = executeDataAction(dir, "define", {
      name: "migranas",
      kind: "series",
      key: ["fecha", "hora"],
      columns: { fecha: "date", hora: "string", intensidad: "number" },
      mode: "on_mention",
      instructions: "One row per episode.",
    });
    expect(def.ok).toBe(true);
    expect(existsSync(join(dir, "user/data/index.md"))).toBe(true);

    const ctx = assembleSessionContext(dir, new Date("2026-10-11T10:00:00"));
    expect(ctx.message).toMatch(/# Active data to record on mention/);
    expect(ctx.message).toContain("migranas (user/data/migranas.csv)");

    const list = executeDataAction(dir, "list");
    expect(list.ok).toBe(true);
    if (list.ok) {
      expect(list.text).not.toContain("inactive until sprint 6");
    }
  });
});
