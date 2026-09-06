// tests/unit/jira-result.test.ts — ConnectorResult text formatting (Sprint 1 hotfix).

import { describe, expect, it } from "vitest";

import { en } from "../../src/lib/i18n/en";
import {
  connectorErrorMessage,
  connectorResultToText,
  jiraErrorMessagesFromLocale,
} from "../../backends/connectors/jira-result";

describe("jira result formatting", () => {
  const messages = jiraErrorMessagesFromLocale(en);

  it("resolves code-based error suggestions", () => {
    const text = connectorErrorMessage(
      {
        error: "Jira authentication failed",
        code: 401,
        recoverable: false,
        suggestion: "jiraError401",
      },
      messages,
    );
    expect(text).toContain(en.jiraError401);
    expect(text).not.toContain("jiraError401");
  });

  it("appends display hint for successful results with data", () => {
    const text = connectorResultToText({ data: "PROJ-1: Build feature", stale: false });
    expect(text).toContain("PROJ-1: Build feature");
    expect(text).toContain("[Display hint:");
    expect(text).toContain("full");
  });

  it("does not append display hint for errors or empty data", () => {
    expect(
      connectorResultToText({
        data: "",
        stale: false,
        error: { error: "fail", code: 0, recoverable: false, suggestion: "jiraErrorNetwork" },
      }),
    ).not.toContain("[Display hint:");
    expect(connectorResultToText({ data: "", stale: false })).toBe("");
  });
});
