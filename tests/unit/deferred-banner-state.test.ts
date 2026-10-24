// tests/unit/deferred-banner-state.test.ts — FR-DEFERRED-04/05 banner open state.

import { describe, expect, it } from "vitest";
import { get } from "svelte/store";

import { createChatController } from "../../src/lib/chat-controller";

function fakeWorker() {
  return {
    prompt: async () => {},
    abort: async () => {},
    resolvePermission: async () => {},
    dismissDeferredItems: async () => {},
    shutdown: async () => {},
    newTopic: async () => {},
    wrapUp: async () => {},
  };
}

describe("deferred banner open state (FR-DEFERRED-05)", () => {
  it("Close hides the banner until the next heartbeat delivery re-opens it", () => {
    const controller = createChatController(fakeWorker());
    expect(get(controller.deferredBannerOpen)).toBe(true);
    controller.closeWelcome();
    expect(get(controller.deferredBannerOpen)).toBe(false);
    controller.showDeferredBanner();
    expect(get(controller.deferredBannerOpen)).toBe(true);
  });
});
