// tests/unit/consolidation-mechanics.test.ts — Part 1 brain template mechanical helpers.

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  computeHebbianReport,
  extractDaySummaryKeyThemes,
  extractRipeObservations,
  findDatedInboxItems,
  findUpcomingReminders,
  formatRipeObservationsBlock,
  relocateBrainFile,
  rewriteBrokenLinks,
  rotateLogs,
  updateLogsIndexFromDaySummary,
} from "../../backends/consolidation-mechanics";
import { initTestGitRepo } from "../support/test-git";

describe("consolidation mechanics", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  function setupRoot(): void {
    dir = mkdtempSync(join(tmpdir(), "buddy-consol-mech-"));
  }

  describe("rotateLogs", () => {
    it("does nothing when at or below threshold", () => {
      setupRoot();
      const logsDir = join(dir, "logs");
      mkdirSync(logsDir, { recursive: true });

      for (let i = 1; i <= 20; i += 1) {
        const day = String(i).padStart(2, "0");
        writeFileSync(join(logsDir, `2026-07-${day}.md`), "# log\n");
      }

      const result = rotateLogs(dir, "2026-07-20");
      expect(result.archived).toEqual([]);
      expect(existsSync(join(logsDir, "2026-07-01.md"))).toBe(true);
    });

    it("archives oldest files and updates indexes", () => {
      setupRoot();
      const logsDir = join(dir, "logs");
      mkdirSync(logsDir, { recursive: true });
      writeFileSync(
        join(logsDir, "index.md"),
        "- 2026-07-01: active\n- 2026-07-30: active\n",
      );

      for (let i = 1; i <= 30; i += 1) {
        const day = String(i).padStart(2, "0");
        writeFileSync(join(logsDir, `2026-07-${day}.md`), "# log\n");
      }
      writeFileSync(join(logsDir, "index.md"), "- index entry\n");
      writeFileSync(join(logsDir, "monthly_2026-07.md"), "# monthly\n");

      const result = rotateLogs(dir, "2026-07-30");
      expect(result.archived).toEqual(["2026-07-01.md", "2026-07-02.md"]);
      expect(existsSync(join(logsDir, "2026-07-01.md"))).toBe(false);
      expect(existsSync(join(logsDir, "archive", "2026-07", "2026-07-01.md"))).toBe(true);
      expect(existsSync(join(logsDir, "monthly_2026-07.md"))).toBe(true);
      expect(existsSync(join(logsDir, "index.md"))).toBe(true);
    });
  });

  describe("computeHebbianReport", () => {
    it("counts active sessions and reads tracked file metadata", () => {
      setupRoot();
      mkdirSync(join(dir, "agent_brain", "concepts"), { recursive: true });
      mkdirSync(join(dir, "agent_brain", "identity"), { recursive: true });
      mkdirSync(join(dir, "logs"), { recursive: true });

      writeFileSync(
        join(dir, "logs", "index.md"),
        "- 2026-07-20: active\n- 2026-07-21: active\n- 2026-07-22: maintenance\n",
      );
      writeFileSync(
        join(dir, "agent_brain", "concepts", "foo.md"),
        "---\naccess_count: 4\nlast_accessed: 2026-07-20\ncreated: 2026-07-01\n---\n\n# Foo\n",
      );
      writeFileSync(join(dir, "agent_brain", "identity", "USER.md"), "# user\n");

      const report = computeHebbianReport(dir, new Date(2026, 6, 22, 12, 0, 0));
      expect(report.activeSessions).toBe(2);
      expect(report.recentActiveSessions).toBe(2);
      expect(report.files).toHaveLength(1);
      expect(report.files[0]?.path).toBe("agent_brain/concepts/foo.md");
      expect(report.files[0]?.accessCount).toBe(4);
    });

    it("returns empty file list for fresh instance", () => {
      setupRoot();
      const report = computeHebbianReport(dir);
      expect(report.activeSessions).toBe(0);
      expect(report.files).toEqual([]);
    });
  });

  describe("findDatedInboxItems", () => {
    it("finds inbox items matching target date or tomorrow", () => {
      setupRoot();
      mkdirSync(join(dir, "user"), { recursive: true });
      writeFileSync(
        join(dir, "user", "inbox.md"),
        "- Call doctor 2026-07-24\n- Later task 2026-07-30\n- Today item 2026-07-23\n",
      );

      const items = findDatedInboxItems(dir, "2026-07-23");
      expect(items).toEqual([
        "- Call doctor 2026-07-24",
        "- Today item 2026-07-23",
      ]);
    });

    it("returns empty when inbox is missing or has no matches", () => {
      setupRoot();
      expect(findDatedInboxItems(dir, "2026-07-23")).toEqual([]);

      mkdirSync(join(dir, "user"), { recursive: true });
      writeFileSync(join(dir, "user", "inbox.md"), "- No dates here\n");
      expect(findDatedInboxItems(dir, "2026-07-23")).toEqual([]);
    });
  });

  describe("findUpcomingReminders", () => {
    it("includes active context deadlines", () => {
      setupRoot();
      mkdirSync(join(dir, "user"), { recursive: true });
      writeFileSync(join(dir, "user", "inbox.md"), "- Inbox item 2026-07-24\n");
      writeFileSync(
        join(dir, "AGENTS.md"),
        "# Agent\n\n## Active context\n\n### Right now\n- Submit report 2026-07-24\n\n### Files\n",
      );

      const reminders = findUpcomingReminders(dir, "2026-07-23");
      expect(reminders).toHaveLength(2);
      expect(reminders.some((r) => r.source === "inbox")).toBe(true);
      expect(reminders.some((r) => r.source === "active-context")).toBe(true);
    });
  });

  describe("extractRipeObservations", () => {
    it("returns unresolved entries at seen 2+", () => {
      setupRoot();
      mkdirSync(join(dir, "agent_brain"), { recursive: true });
      writeFileSync(
        join(dir, "agent_brain", "observations.md"),
        `---
summary: Observations
created: 2026-07-01
---

# Observations

## Concept candidates

- **2026-07-01:** Fresh pattern (seen: 1)

- **2026-07-02:** Ripe concept candidate — should promote (seen: 1)
  - 2026-07-03: seen again in eval (seen: 2)

- **2026-07-04:** Already resolved (seen: 3) → **resolved 2026-07-05:** concept [foo](concepts/foo.md)

## Rule candidates

- **2026-07-05:** Ripe rule (seen: 2)
`,
      );

      const ripe = extractRipeObservations(dir);
      expect(ripe).toHaveLength(2);
      const concept = ripe.find((r) => r.category === "concept");
      const rule = ripe.find((r) => r.category === "rule");
      expect(concept?.seenCount).toBe(2);
      expect(concept?.text).toContain("Ripe concept candidate");
      expect(rule?.seenCount).toBe(2);
    });

    it("formats empty and non-empty ripe blocks", () => {
      expect(formatRipeObservationsBlock([])).toContain("None at seen 2+");
      expect(
        formatRipeObservationsBlock([
          { category: "concept", text: "- **2026-07-02:** Example", seenCount: 2 },
        ]),
      ).toContain("[concept] (seen: 2)");
    });
  });

  describe("updateLogsIndexFromDaySummary", () => {
    it("updates index line from Day summary Key themes", () => {
      setupRoot();
      mkdirSync(join(dir, "logs"), { recursive: true });
      writeFileSync(
        join(dir, "logs", "index.md"),
        "# Sessions index\n\n- 2026-07-23: active — old description\n",
      );
      writeFileSync(
        join(dir, "logs", "2026-07-23.md"),
        `---
date: 2026-07-23
---

## Day summary
- **Key themes:** Buddy eval fixes, observation promotion, grouping
- **Moved forward:** worker mechanics
`,
      );

      updateLogsIndexFromDaySummary(dir, "2026-07-23");
      const index = readFileSync(join(dir, "logs", "index.md"), "utf8");
      expect(index).toContain(
        "- 2026-07-23: active — Buddy eval fixes, observation promotion, grouping",
      );
      expect(index).not.toContain("old description");
    });

    it("extractDaySummaryKeyThemes parses Key themes line", () => {
      const themes = extractDaySummaryKeyThemes(
        "## Day summary\n- **Key themes:** One, two, three\n",
      );
      expect(themes).toBe("One, two, three");
    });
  });

  describe("rewriteBrokenLinks", () => {
    it("updates relative markdown links after a move", () => {
      setupRoot();
      mkdirSync(join(dir, "agent_brain", "concepts"), { recursive: true });
      writeFileSync(join(dir, "agent_brain", "concepts", "foo.md"), "# Foo\n");
      writeFileSync(
        join(dir, "agent_brain", "concepts", "bar.md"),
        "# Bar\n\nSee [foo](../concepts/foo.md).\n",
      );

      const rewritten = rewriteBrokenLinks(
        dir,
        "agent_brain/concepts/foo.md",
        "agent_brain/concepts/cluster/foo.md",
      );

      expect(rewritten).toEqual(["agent_brain/concepts/bar.md"]);
      const bar = readFileSync(join(dir, "agent_brain", "concepts", "bar.md"), "utf8");
      expect(bar).toContain("](cluster/foo.md)");
    });
  });

  describe("relocateBrainFile", () => {
    async function setupGitRoot(): Promise<void> {
      setupRoot();
      writeFileSync(join(dir, "AGENTS.md"), "# Rules\n");
      mkdirSync(join(dir, "agent_brain", "concepts"), { recursive: true });
      writeFileSync(join(dir, "agent_brain", "concepts", "foo.md"), "# Foo\n");
      await initTestGitRepo(dir);
      const { simpleGit } = await import("simple-git");
      await simpleGit(dir).add("-A").commit("seed");
    }

    it("moves a file with git mv and rewrites links", async () => {
      await setupGitRoot();
      writeFileSync(
        join(dir, "agent_brain", "concepts", "bar.md"),
        "# Bar\n\nSee [foo](foo.md).\n",
      );
      const { simpleGit } = await import("simple-git");
      await simpleGit(dir).add("-A").commit("bar");

      const result = await relocateBrainFile(
        dir,
        "agent_brain/concepts/foo.md",
        "agent_brain/concepts/cluster/foo.md",
      );

      expect(existsSync(join(dir, "agent_brain", "concepts", "cluster", "foo.md"))).toBe(true);
      expect(existsSync(join(dir, "agent_brain", "concepts", "foo.md"))).toBe(false);
      expect(result.rewrittenLinks).toContain("agent_brain/concepts/bar.md");
      const bar = readFileSync(join(dir, "agent_brain", "concepts", "bar.md"), "utf8");
      expect(bar).toContain("](cluster/foo.md)");
    });

    it("creates destination parent directories", async () => {
      await setupGitRoot();

      await relocateBrainFile(
        dir,
        "agent_brain/concepts/foo.md",
        "agent_brain/concepts/nested/cluster/foo.md",
      );

      expect(
        existsSync(join(dir, "agent_brain", "concepts", "nested", "cluster", "foo.md")),
      ).toBe(true);
    });

    it("rejects paths outside agent_brain", async () => {
      await setupGitRoot();
      mkdirSync(join(dir, "user"), { recursive: true });
      writeFileSync(join(dir, "user", "inbox.md"), "# Inbox\n");
      await import("simple-git").then(({ simpleGit }) => simpleGit(dir).add("-A").commit("inbox"));

      await expect(
        relocateBrainFile(dir, "user/inbox.md", "agent_brain/inbox.md"),
      ).rejects.toThrow("source must be within agent_brain/");
    });

    it("rejects missing source files", async () => {
      await setupGitRoot();

      await expect(
        relocateBrainFile(dir, "agent_brain/missing.md", "agent_brain/x/y.md"),
      ).rejects.toThrow(/does not exist/);
    });
  });
});
