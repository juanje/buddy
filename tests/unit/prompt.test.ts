// tests/unit/prompt.test.ts — system prompt assembly (last log selection).

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { assembleSystemPrompt } from "../../backends/prompt";

describe("assembleSystemPrompt last log selection", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("loads the last index entry regardless of maintenance status", () => {
    dir = mkdtempSync(join(tmpdir(), "ab-prompt-"));
    mkdirSync(join(dir, "logs"), { recursive: true });
    writeFileSync(
      join(dir, "logs", "index.md"),
      [
        "# Sessions index",
        "",
        "Log files: `logs/YYYY-MM-DD.md` (derive from the date in each entry).",
        "",
        "- 2026-07-20: active — Prior day.",
        "- 2026-07-21: maintenance — Weekly consolidation.",
        "",
      ].join("\n"),
      "utf8",
    );
    writeFileSync(
      join(dir, "logs", "2026-07-21.md"),
      [
        "---",
        "date: 2026-07-21",
        "status: maintenance",
        "---",
        "",
        "## Session 14:00–18:00",
        "",
        "### Context",
        "FR-CONSOL heartbeat shipped.",
        "",
      ].join("\n"),
      "utf8",
    );

    const { prompt } = assembleSystemPrompt(dir, new Date("2026-07-22T12:00:00Z"));

    expect(prompt).toContain("# Last session log");
    const lastLogSection = prompt.split("# Last session log")[1]?.split("\n\n---\n\n")[0] ?? "";
    expect(lastLogSection).toContain("FR-CONSOL heartbeat shipped.");
    expect(lastLogSection).not.toContain("Prior day.");
  });
});
