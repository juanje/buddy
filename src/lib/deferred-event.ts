// src/lib/deferred-event.ts — deferred event routing.

/**
 * Orientation suppresses the duplicate in-app banner, not deferred delivery.
 * System notifications must continue after the orientation card is closed.
 */
export function shouldNotifyDeferredDue(opts: {
  count: number;
  orientationShownThisSession: boolean;
}): boolean {
  void opts.orientationShownThisSession;
  return opts.count > 0;
}
