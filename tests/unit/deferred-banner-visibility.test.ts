// tests/unit/deferred-banner-visibility.test.ts — FR-ORIENT-05 / FR-DEFERRED-05 banner visibility.

import { describe, expect, it } from "vitest";

import { shouldShowDeferredBanner } from "../../src/lib/deferred-banner-visibility";

describe("shouldShowDeferredBanner", () => {
  it("shows the open banner once the orientation card is gone, whatever happened earlier", () => {
    expect(shouldShowDeferredBanner({ hasOrientationCard: false, bannerOpen: true })).toBe(true);
  });

  it("hides the banner while the orientation card is visible", () => {
    expect(shouldShowDeferredBanner({ hasOrientationCard: true, bannerOpen: true })).toBe(false);
  });

  it("hides a banner the user closed", () => {
    expect(shouldShowDeferredBanner({ hasOrientationCard: false, bannerOpen: false })).toBe(false);
  });
});
