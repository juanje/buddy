// tests/unit/keyboard.test.ts — FR-CHAT-02 deterministic keyboard logic.

import { describe, expect, it } from "vitest";
import { resolveInputKey } from "../../src/lib/keyboard";

describe("resolveInputKey (FR-CHAT-02)", () => {
  it("Enter sends", () => {
    expect(resolveInputKey({ key: "Enter", shiftKey: false })).toBe("send");
  });

  it("Shift+Enter inserts a newline", () => {
    expect(resolveInputKey({ key: "Enter", shiftKey: true })).toBe("newline");
  });

  it("other keys do nothing", () => {
    expect(resolveInputKey({ key: "a", shiftKey: false })).toBe("none");
    expect(resolveInputKey({ key: "Escape", shiftKey: false })).toBe("none");
    expect(resolveInputKey({ key: "a", shiftKey: true })).toBe("none");
  });
});
