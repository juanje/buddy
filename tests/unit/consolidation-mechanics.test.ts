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
  findDatedInboxItems,
  findUpcomingReminders,
  resolveSubjectiveDate,
  rotateLogs,
} from "../../backends/consolidation-mechanics";

describe("consolidation mechanics", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  function setupRoot(): void {
    dir = mkdtempSync(join(tmpdir(), "ab-consol-mech-"));
  }

  describe("resolveSubjectiveDate", () => {
    it("uses yesterday between 00:00 and 04:59", () => {
      expect(resolveSubjectiveDate(new Date(2026, 6, 24, 0, 0, 0))).toBe("2026-07-23");
      expect(resolveSubjectiveDate(new Date(2026, 6, 24, 3, 0, 0))).toBe("2026-07-23");
      expect(resolveSubjectiveDate(new Date(2026, 6, 24, 4, 59, 0))).toBe("2026-07-23");
    });

    it("uses today from 05:00 onward", () => {
      expect(resolveSubjectiveDate(new Date(2026, 6, 24, 5, 0, 0))).toBe("2026-07-24");
      expect(resolveSubjectiveDate(new Date(2026, 6, 24, 6, 0, 0))).toBe("2026-07-24");
    });
  });

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
});
