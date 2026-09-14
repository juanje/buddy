import { describe, expect, it } from "vitest";

import { shouldNotifyDeferredDue } from "../../src/lib/deferred-event";

describe("shouldNotifyDeferredDue", () => {
  it("still allows the system notification after orientation was shown", () => {
    expect(shouldNotifyDeferredDue({ count: 1, orientationShownThisSession: true })).toBe(true);
  });

  it("does not notify when there are no due items", () => {
    expect(shouldNotifyDeferredDue({ count: 0, orientationShownThisSession: true })).toBe(false);
  });
});
