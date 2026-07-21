// tests/unit/input-bar.test.ts — FR-CHAT-08 textarea height helpers.

import { describe, expect, it } from "vitest";

import {
  autoResizeTextarea,
  resetTextareaHeight,
  sendAndResetTextarea,
} from "../../src/lib/input-bar";

function mockTextarea(scrollHeight: number) {
  return {
    style: { height: "24px" },
    scrollHeight,
  };
}

describe("input-bar helpers", () => {
  it("autoResizeTextarea caps height at max", () => {
    const textarea = mockTextarea(200);
    autoResizeTextarea(textarea, 160);
    expect(textarea.style.height).toBe("160px");
  });

  it("resetTextareaHeight sets height to auto", () => {
    const textarea = mockTextarea(120);
    textarea.style.height = "120px";
    resetTextareaHeight(textarea);
    expect(textarea.style.height).toBe("auto");
  });

  it("sendAndResetTextarea clears via send callback then resets height", async () => {
    const textarea = mockTextarea(80);
    textarea.style.height = "80px";
    let sent = false;
    await sendAndResetTextarea(async () => {
      sent = true;
    }, textarea);
    expect(sent).toBe(true);
    expect(textarea.style.height).toBe("auto");
  });
});
