// tests/unit/prompt-task-vocabulary.test.ts — the prompts name only what the
// tasks() tool actually has (FR-TASKM-10).
//
// The prompts tell the agent which list params to pass and which result
// fields to read. When FR-TASKM-08 removed `include_future` and `futureCount`
// from the tool, both prompts kept naming them with the full gate green: a
// prompt can describe a tool that no longer exists without anyone disobeying
// anything. This checks the names against the tool itself, not a copy of them.

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { executeTaskAction } from "../../backends/tasks/task-actions";
import { writeTasksFile } from "../../backends/tasks/task-file";

const PROMPTS = ["agents-base.md", "consolidation.md"];

function promptText(name: string): string {
  return readFileSync(join(process.cwd(), "bundled", "prompts", name), "utf8");
}

function namesMatching(text: string, pattern: RegExp): string[] {
  return [...new Set([...text.matchAll(pattern)].map((m) => m[1]!))];
}

describe("task vocabulary in bundled prompts", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "buddy-prompt-vocab-"));
    writeTasksFile(dir, [{ id: 1, text: "Call dentist", done: false, next: true, area: "health" }]);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it.each(PROMPTS)("%s names only list params the tool accepts", (name) => {
    const help = executeTaskAction(dir, "help");
    expect(help.ok).toBe(true);
    const helpText = help.ok ? help.message : "";
    const params = namesMatching(promptText(name), /\b((?:include|only)_[a-z_]+)\b/g);
    expect(params.filter((param) => !helpText.includes(param))).toEqual([]);
  });

  it.each(PROMPTS)("%s names only list result counts the tool returns", (name) => {
    const listed = executeTaskAction(dir, "list");
    expect(listed.ok && listed.list).toBeTruthy();
    const fields = listed.ok && listed.list ? Object.keys(listed.list) : [];
    const counts = namesMatching(promptText(name), /\b([a-z]+Count)\b/g);
    expect(counts.filter((count) => !fields.includes(count))).toEqual([]);
  });
});
