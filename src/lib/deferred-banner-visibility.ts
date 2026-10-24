// src/lib/deferred-banner-visibility.ts — when the deferred banner is on screen.
//
// FR-ORIENT-05: hidden while the orientation card is visible, so one card does
// not replace the other. FR-DEFERRED-05: otherwise it follows the controller's
// open state, which Close turns off and every heartbeat delivery turns back on.

export function shouldShowDeferredBanner(opts: {
  hasOrientationCard: boolean;
  bannerOpen: boolean;
}): boolean {
  if (opts.hasOrientationCard) return false;
  return opts.bannerOpen;
}
