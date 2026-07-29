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

// FR-CHAT-08 regression, 2026-07-29. The reset ran before the framework had
// applied the cleared value, so `height: auto` resolved against the text still
// in the DOM and the box stayed tall until the next keystroke.
describe("sendAndResetTextarea ordering", () => {
  it("resets only after the cleared value has been applied", async () => {
    const order: string[] = [];
    const textarea = {
      style: {
        set height(_v: string) {
          order.push("reset");
        },
        get height() {
          return "";
        },
      },
      scrollHeight: 300,
    };

    await sendAndResetTextarea(
      async () => {
        order.push("send");
      },
      textarea as never,
      async () => {
        order.push("flush");
      },
    );

    expect(order.slice(0, 2)).toEqual(["send", "flush"]);
    expect(order).toContain("reset");
    expect(order.indexOf("reset")).toBeGreaterThan(order.indexOf("flush"));
  });

  it("still works when no flush is supplied", async () => {
    const textarea = { style: { height: "120px" }, scrollHeight: 300 };
    await sendAndResetTextarea(async () => {}, textarea as never);
    expect(textarea.style.height).toBe("auto");
  });
});
