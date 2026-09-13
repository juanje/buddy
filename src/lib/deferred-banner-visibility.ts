// src/lib/deferred-banner-visibility.ts — FR-ORIENT-05: suppress deferred banner
// after the first-open orientation card has been shown this session.

export function shouldShowDeferredBanner(opts: {
  hasOrientationCard: boolean;
  deferredDismissed: boolean;
  orientationShownThisSession: boolean;
}): boolean {
  if (opts.hasOrientationCard) return false;
  if (opts.deferredDismissed) return false;
  if (opts.orientationShownThisSession) return false;
  return true;
}
