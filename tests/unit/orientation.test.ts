// tests/unit/orientation.test.ts — FR-ORIENT unit tests.

import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { parseDeferredItems } from "../../backends/deferred";
import {
  buildOrientationData,
  markOrientationDismissed,
  selectNextTasks,
} from "../../backends/orientation";
import { readLastOrientationDate, writeLastOrientationDate } from "../../backends/orientation-config";
import { fetchOneLinerFromSession } from "../../backends/orientation-one-liner";
import { buildOneLinerPrompt } from "../../backends/orientation-prompt";
import { writeTasksFile } from "../../backends/tasks/task-file";
import { FakeSession } from "../support/fake-session";
import { setupGlobalConfigDir, teardownGlobalConfigDir } from "../support/global-config";

describe("orientation (FR-ORIENT-02)", () => {
  let configDir: string;

  afterEach(() => {
    teardownGlobalConfigDir(configDir);
  });

  it("selectNextTasks picks one next task per area up to the limit", () => {
    const items = [
      { id: 1, text: "A", done: false, next: true, area: "dev" },
      { id: 2, text: "B", done: false, next: true, area: "dev" },
      { id: 3, text: "C", done: false, next: true, area: "home" },
      { id: 4, text: "D", done: false, next: false, area: "work" },
    ];
    const chosen = selectNextTasks(items, 3);
    expect(chosen.map((t) => t.text)).toEqual(["A", "C", "D"]);
  });

  it("buildOrientationData returns null when already shown today", () => {
    const fixture = setupGlobalConfigDir();
    configDir = fixture.configDir;
    const rootDir = mkdtempSync(join(tmpdir(), "buddy-orient-unit-"));
    writeLastOrientationDate("2026-09-10", join(configDir, "config.json"));
    expect(buildOrientationData(rootDir, "2026-09-10", join(configDir, "config.json"))).toBeNull();
    rmSync(rootDir, { recursive: true, force: true });
  });

  it("buildOrientationData bundles deferred and next tasks", () => {
    const fixture = setupGlobalConfigDir();
    configDir = fixture.configDir;
    const rootDir = mkdtempSync(join(tmpdir(), "buddy-orient-unit-"));
    mkdirSync(join(rootDir, "agent_brain"), { recursive: true });
    writeFileSync(
      join(rootDir, "agent_brain", "deferred.md"),
      "- **reminder** (2026-09-10, user): Call dentist.\n",
      "utf8",
    );
    writeTasksFile(rootDir, [{ id: 1, text: "Review PR", done: false, next: true, area: "dev" }]);
    const data = buildOrientationData(rootDir, "2026-09-10", join(configDir, "config.json"));
    expect(data?.deferred).toHaveLength(1);
    expect(data?.nextTasks[0]?.text).toBe("Review PR");
    rmSync(rootDir, { recursive: true, force: true });
  });

  it("markOrientationDismissed writes date and clears due deferred items", () => {
    const fixture = setupGlobalConfigDir();
    configDir = fixture.configDir;
    const rootDir = mkdtempSync(join(tmpdir(), "buddy-orient-unit-"));
    mkdirSync(join(rootDir, "agent_brain"), { recursive: true });
    const deferredPath = join(rootDir, "agent_brain", "deferred.md");
    writeFileSync(deferredPath, "- **reminder** (2026-09-10, user): Call dentist.\n", "utf8");
    markOrientationDismissed(rootDir, "2026-09-10", join(configDir, "config.json"));
    expect(readLastOrientationDate(join(configDir, "config.json"))).toBe("2026-09-10");
    const due = parseDeferredItems(readFileSync(deferredPath, "utf8")).filter(
      (item) => item.dueDate <= "2026-09-10",
    );
    expect(due).toHaveLength(0);
    rmSync(rootDir, { recursive: true, force: true });
  });
});

describe("orientation one-liner (FR-ORIENT-03)", () => {
  it("buildOneLinerPrompt returns a non-empty string", () => {
    expect(buildOneLinerPrompt().length).toBeGreaterThan(0);
  });

  it("fetchOneLinerFromSession collects assistant text", async () => {
    const session = new FakeSession();
    const originalPrompt = session.prompt.bind(session);
    session.prompt = async (text: string) => {
      await originalPrompt(text);
      session.streamResponse(["Worked on orientation card"]);
    };
    const text = await fetchOneLinerFromSession(session);
    expect(text).toBe("Worked on orientation card");
    expect(session.promptCalls[0]).toContain("first time today");
  });
});
