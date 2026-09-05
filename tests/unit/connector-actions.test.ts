// tests/unit/connector-actions.test.ts — FR-CONN-03 action classification + permission gate.

import { afterAll, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { classifyConnectorAction, isConnectorTool } from "../../backends/connectors/actions";
import { ConnectorCacheError, writeCacheFileForTest, writeEntityStore } from "../../backends/connectors/cache";
import { evaluateToolCall } from "../../backends/permissions";

const HOME = mkdtempSync(join(tmpdir(), "buddy-conn-actions-home-"));
const AB = join(HOME, "buddy");
const CONFIG = join(HOME, ".buddy");

mkdirSync(join(AB, "user"), { recursive: true });
mkdirSync(CONFIG, { recursive: true });

afterAll(() => {
  rmSync(HOME, { recursive: true, force: true });
});

describe("connector action classification (FR-CONN-03)", () => {
  it("recognizes connector tool names", () => {
    expect(isConnectorTool("jira")).toBe(true);
    expect(isConnectorTool("read")).toBe(false);
  });

  it("classifies known jira actions", () => {
    expect(classifyConnectorAction("jira", "board")).toBe("read");
    expect(classifyConnectorAction("jira", "transition_issue")).toBe("write");
  });

  it("denies unknown actions fail-closed", () => {
    expect(classifyConnectorAction("jira", "unknown_action")).toBe("deny");
    expect(classifyConnectorAction("unknown", "board")).toBe("deny");
  });

  it("allows read connector calls through the permission gate", () => {
    expect(evaluateToolCall("jira", { action: "board", params: {} }, AB, HOME, CONFIG)).toEqual({
      action: "allow",
    });
  });

  it("asks for write connector calls through the permission gate", () => {
    expect(
      evaluateToolCall("jira", { action: "transition_issue", params: {} }, AB, HOME, CONFIG),
    ).toMatchObject({
      action: "ask",
      kind: "outside",
      op: "write",
      path: "jira:transition_issue",
    });
  });

  it("denies unknown connector actions through the permission gate", () => {
    const decision = evaluateToolCall("jira", { action: "unknown_action", params: {} }, AB, HOME, CONFIG);
    expect(decision.action).toBe("deny");
  });

  it("confines cache writes to the connections directory", () => {
    expect(() => writeEntityStore(AB, "jira", {})).not.toThrow();
    expect(
      evaluateToolCall("write", { path: join(AB, ".buddy/connections/jira/entities.json") }, AB, HOME, CONFIG),
    ).toEqual({ action: "allow" });
  });

  it("refuses cache writes outside connections via containment", () => {
    expect(() => writeCacheFileForTest(AB, "user/board.md", {})).toThrow(ConnectorCacheError);
  });
});
