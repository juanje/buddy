import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSavedNotice, type SavedNoticeState } from "../../src/lib/saved-notice";

describe("createSavedNotice", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup() {
    const states: SavedNoticeState[] = [];
    const notice = createSavedNotice((s) => states.push(s), 1000);
    return { states, notice, last: () => states[states.length - 1] };
  }

  it("shows 'saved' after a save and auto-dismisses", async () => {
    const { notice, last } = setup();
    await notice.save(async () => {});
    expect(last()).toBe("saved");
    vi.advanceTimersByTime(1000);
    expect(last()).toBe(false);
  });

  it("shows 'restart' once after the enabled toggle changed, then 'saved'", async () => {
    const { notice, last } = setup();
    notice.toggleEnabled();
    await notice.save(async () => {});
    expect(last()).toBe("restart");
    await notice.save(async () => {});
    expect(last()).toBe("saved");
  });

  it("hides the notice while saving and when a field changes", async () => {
    const { notice, last } = setup();
    let seenDuringSave: SavedNoticeState | undefined;
    await notice.save(async () => {
      seenDuringSave = last();
    });
    expect(seenDuringSave).toBe(false);
    notice.fieldInput();
    expect(last()).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(last()).toBe(false);
  });

  it("starts a test without waiting for it and hides the notice", async () => {
    const { notice, last } = setup();
    await notice.save(async () => {});
    const onTest = vi.fn(() => new Promise<void>(() => {}));
    notice.test(onTest);
    expect(onTest).toHaveBeenCalledOnce();
    expect(last()).toBe(false);
  });
});
