// tests/unit/slack-url-parser.test.ts — FR-SLACK-02 URL parsing.

import { describe, expect, it } from "vitest";

import { parseSlackUrl, threadFileId } from "../../backends/connectors/slack-url-parser";

describe("slack url parser (FR-SLACK-02)", () => {
  it("parses archives message URLs", () => {
    const ref = parseSlackUrl("https://team.slack.com/archives/C123/p1712345678901234");
    expect(ref.channelId).toBe("C123");
    expect(ref.threadTs).toBe("1712345678.901234");
  });

  it("parses raw channel IDs", () => {
    const ref = parseSlackUrl("C07KSAGDU0H");
    expect(ref.channelId).toBe("C07KSAGDU0H");
    expect(ref.threadTs).toBeUndefined();
  });

  it("builds thread file ids without dots", () => {
    expect(threadFileId("C123", "1712345678.901234")).toBe("C123-1712345678901234");
  });
});
