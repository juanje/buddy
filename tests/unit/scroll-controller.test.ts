// tests/unit/scroll-controller.test.ts — FR-CHAT-07 deterministic scroll logic.

import { describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";
import { createScrollController } from "../../src/lib/scroll-controller";

describe("createScrollController (FR-CHAT-07)", () => {
  it("follows new content while auto-scroll is on", () => {
    const scrollToLatest = vi.fn();
    const ctrl = createScrollController(scrollToLatest);
    ctrl.notifyContentGrown();
    expect(scrollToLatest).toHaveBeenCalledTimes(1);
  });

  it("pauses on manual scroll up and shows the button", () => {
    const scrollToLatest = vi.fn();
    const ctrl = createScrollController(scrollToLatest);
    ctrl.onUserScrolled(false);
    expect(get(ctrl.autoScroll)).toBe(false);
    expect(get(ctrl.showScrollButton)).toBe(true);
    ctrl.notifyContentGrown();
    expect(scrollToLatest).not.toHaveBeenCalled();
  });

  it("resumes when the user scrolls back to the bottom", () => {
    const ctrl = createScrollController(() => {});
    ctrl.onUserScrolled(false);
    ctrl.onUserScrolled(true);
    expect(get(ctrl.autoScroll)).toBe(true);
    expect(get(ctrl.showScrollButton)).toBe(false);
  });

  it("button click scrolls down and resumes", () => {
    const scrollToLatest = vi.fn();
    const ctrl = createScrollController(scrollToLatest);
    ctrl.onUserScrolled(false);
    ctrl.scrollToBottomClicked();
    expect(scrollToLatest).toHaveBeenCalledTimes(1);
    expect(get(ctrl.autoScroll)).toBe(true);
  });

  it("sending a user message scrolls down and resumes", () => {
    const scrollToLatest = vi.fn();
    const ctrl = createScrollController(scrollToLatest);
    ctrl.onUserScrolled(false);
    ctrl.onUserMessageSent();
    expect(scrollToLatest).toHaveBeenCalledTimes(1);
    expect(get(ctrl.autoScroll)).toBe(true);
  });
});
