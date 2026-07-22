// tests/unit/deferred-notify.test.ts — FR-DEFERRED-03 notification dedup.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-notification", () => ({
  sendNotification: vi.fn(),
  isPermissionGranted: vi.fn(async () => true),
  requestPermission: vi.fn(async () => "granted"),
  onAction: vi.fn(async () => ({ unregister: vi.fn() })),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    unminimize: vi.fn(),
    show: vi.fn(),
    setFocus: vi.fn(),
  }),
}));

import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import {
  DEFERRED_NOTIFY_DEDUP_MS,
  notifyDeferredDue,
  resetDeferredNotifyStateForTests,
} from "../../src/utils/deferred-notify";

describe("notifyDeferredDue", () => {
  beforeEach(() => {
    resetDeferredNotifyStateForTests();
    vi.mocked(sendNotification).mockClear();
    vi.mocked(isPermissionGranted).mockResolvedValue(true);
    vi.mocked(requestPermission).mockResolvedValue("granted");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends a notification when permission is granted", async () => {
    await notifyDeferredDue(2, { title: "Buddy", body: "2 pending" });
    expect(sendNotification).toHaveBeenCalledWith({
      title: "Buddy",
      body: "2 pending",
      autoCancel: true,
    });
  });

  it("deduplicates notifications within the cooldown window", async () => {
    vi.useFakeTimers();
    await notifyDeferredDue(1, { title: "Buddy", body: "one" });
    vi.advanceTimersByTime(DEFERRED_NOTIFY_DEDUP_MS - 1000);
    await notifyDeferredDue(1, { title: "Buddy", body: "one again" });
    expect(sendNotification).toHaveBeenCalledTimes(1);
  });

  it("skips when count is zero", async () => {
    await notifyDeferredDue(0, { title: "Buddy", body: "none" });
    expect(sendNotification).not.toHaveBeenCalled();
  });
});
