// src/lib/deferred-event.ts — deferred event routing.

/**
 * Orientation suppresses the duplicate in-app banner, not deferred delivery.
 * System notifications must continue after the orientation card is closed.
 */
export function shouldNotifyDeferredDue(opts: {
  count: number;
}): boolean {
  return opts.count > 0;
}
