// src/lib/deferred-event.ts — deferred event routing.

import type { DeferredItemView } from "../../shared/api";

/**
 * Orientation suppresses the duplicate in-app banner, not deferred delivery.
 * System notifications must continue after the orientation card is closed.
 */
export function shouldNotifyDeferredDue(opts: {
  count: number;
}): boolean {
  return opts.count > 0;
}

export interface DeferredDueDeps {
  title: string;
  setItems(items: DeferredItemView[]): void;
  showBanner(): void;
  notify(count: number, labels: { title: string; body: string }): void;
}

/**
 * A heartbeat delivery of due items (FR-DEFERRED-03/05). The banner re-opens
 * every time, after orientation or a Close, so a system notification always
 * has its text in the app.
 */
export function handleDeferredDue(items: DeferredItemView[], deps: DeferredDueDeps): void {
  deps.setItems(items);
  if (items.length > 0) deps.showBanner();
  if (!shouldNotifyDeferredDue({ count: items.length })) return;
  const first = items[0]?.text ?? "";
  const body = items.length <= 1 ? first : `${first} (+${items.length - 1})`;
  deps.notify(items.length, { title: deps.title, body });
}
