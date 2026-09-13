// tests/unit/deferred-banner-visibility.test.ts — FR-ORIENT-05 banner suppression.

import { describe, expect, it } from "vitest";

import { shouldShowDeferredBanner } from "../../src/lib/deferred-banner-visibility";

describe("shouldShowDeferredBanner (FR-ORIENT-05)", () => {
  it("hides the banner when orientation was shown this session", () => {
    expect(
      shouldShowDeferredBanner({
        hasOrientationCard: false,
        deferredDismissed: false,
        orientationShownThisSession: true,
      }),
    ).toBe(false);
  });

  it("shows the banner when orientation was not shown this session", () => {
    expect(
      shouldShowDeferredBanner({
        hasOrientationCard: false,
        deferredDismissed: false,
        orientationShownThisSession: false,
      }),
    ).toBe(true);
  });

  it("hides the banner while the orientation card is visible", () => {
    expect(
      shouldShowDeferredBanner({
        hasOrientationCard: true,
        deferredDismissed: false,
        orientationShownThisSession: true,
      }),
    ).toBe(false);
  });
});
