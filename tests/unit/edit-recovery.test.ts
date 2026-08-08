// tests/unit/edit-recovery.test.ts — FR-GUARD-02 unit tests.

import { describe, expect, it } from "vitest";

import {
  enrichEditError,
  enrichEditToolResult,
  extractToolResultText,
} from "../../backends/edit-recovery";

describe("enrichEditError", () => {
  it("returns re-read hint for not-found errors", () => {
    const msg =
      "Could not find the exact text in agent_brain/deferred.md. The old text must match exactly including all whitespace and newlines.";
    expect(enrichEditError(msg)).toMatch(/Re-read the file/i);
  });

  it("returns re-read hint for batched not-found errors", () => {
    const msg =
      "Could not find edits[0] in user/inbox.md. The oldText must match exactly including all whitespace and newlines.";
    expect(enrichEditError(msg)).toMatch(/Re-read the file/i);
  });

  it("returns unique-anchor hint for duplicate occurrences", () => {
    const msg =
      "Found 2 occurrences of the text in agent_brain/deferred.md. The text must be unique.";
    expect(enrichEditError(msg)).toMatch(/surrounding lines/i);
  });

  it("returns identity hint for no-change errors", () => {
    const msg =
      "No changes made to agent_brain/observations.md. The replacement produced identical content.";
    expect(enrichEditError(msg)).toMatch(/identical/i);
  });

  it("returns null for unknown errors", () => {
    expect(enrichEditError("Permission denied")).toBeNull();
  });
});

describe("extractToolResultText", () => {
  it("reads text blocks from Pi-shaped results", () => {
    const text = extractToolResultText({
      content: [{ type: "text", text: "Could not find the exact text" }],
    });
    expect(text).toContain("Could not find");
  });
});

describe("enrichEditToolResult", () => {
  it("appends a hint to edit error content", () => {
    const original = {
      content: [{ type: "text", text: "Could not find the exact text in foo.md." }],
    };
    const enriched = enrichEditToolResult(original);
    expect(enriched).toBeDefined();
    const text = extractToolResultText(enriched!);
    expect(text).toMatch(/Re-read the file/i);
    expect(text).toContain("Could not find the exact text");
  });

  it("returns undefined when no hint applies", () => {
    expect(
      enrichEditToolResult({
        content: [{ type: "text", text: "Permission denied" }],
      }),
    ).toBeUndefined();
  });
});
