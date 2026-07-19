// src/lib/scroll-controller.ts — FR-CHAT-07: auto-scroll with manual override.
// Framework-agnostic: the view provides `scrollToLatest` (DOM scroll) and
// reports user scrolls; BDD tests provide a simulated viewport instead.
//
// Rules (from SPEC FR-CHAT-07):
// - While the user has NOT scrolled up, new content keeps the view pinned
//   to the bottom.
// - A manual scroll away from the bottom pauses auto-scroll and shows a
//   "scroll to bottom" button.
// - Clicking the button, reaching the bottom manually, or sending a new
//   user message re-enables auto-scroll.

import { derived, get, writable, type Readable } from "svelte/store";

export interface ScrollController {
  /** True while the view follows new content. */
  autoScroll: Readable<boolean>;
  /** "Scroll to bottom" button visibility (shown when auto-scroll paused). */
  showScrollButton: Readable<boolean>;

  /** View: content grew (new message / new delta). */
  notifyContentGrown(): void;
  /** View: the user scrolled; report whether they are at the bottom. */
  onUserScrolled(atBottom: boolean): void;
  /** View: the "scroll to bottom" button was clicked. */
  scrollToBottomClicked(): void;
  /** View: the user sent a new message. */
  onUserMessageSent(): void;
}

export function createScrollController(scrollToLatest: () => void): ScrollController {
  const autoScroll = writable(true);
  const showScrollButton = derived(autoScroll, ($a) => !$a);

  function notifyContentGrown(): void {
    if (get(autoScroll)) scrollToLatest();
  }

  function onUserScrolled(atBottom: boolean): void {
    autoScroll.set(atBottom);
  }

  function scrollToBottomClicked(): void {
    autoScroll.set(true);
    scrollToLatest();
  }

  function onUserMessageSent(): void {
    autoScroll.set(true);
    scrollToLatest();
  }

  return {
    autoScroll,
    showScrollButton,
    notifyContentGrown,
    onUserScrolled,
    scrollToBottomClicked,
    onUserMessageSent,
  };
}
