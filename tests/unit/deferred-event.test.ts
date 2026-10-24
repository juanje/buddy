import { describe, expect, it } from "vitest";

import type { DeferredItemView } from "../../shared/api";
import { handleDeferredDue, shouldNotifyDeferredDue } from "../../src/lib/deferred-event";

function item(text: string): DeferredItemView {
  return { type: "reminder", dueDate: "2026-10-24", source: "user", text, overdue: false };
}

describe("shouldNotifyDeferredDue", () => {
  it("still allows the system notification after orientation was shown", () => {
    expect(shouldNotifyDeferredDue({ count: 1 })).toBe(true);
  });

  it("does not notify when there are no due items", () => {
    expect(shouldNotifyDeferredDue({ count: 0 })).toBe(false);
  });
});

describe("handleDeferredDue (FR-DEFERRED-05)", () => {
  it("shows the items, re-opens the banner and notifies with the first item and a count", () => {
    const calls: string[] = [];
    let shown: DeferredItemView[] = [];
    handleDeferredDue([item("Call the dentist"), item("Renew passport")], {
      title: "buddy",
      setItems: (items) => {
        shown = items;
      },
      showBanner: () => calls.push("banner"),
      notify: (count, labels) => calls.push(`notify ${count} ${labels.title}: ${labels.body}`),
    });
    expect(shown.map((i) => i.text)).toEqual(["Call the dentist", "Renew passport"]);
    expect(calls).toEqual(["banner", "notify 2 buddy: Call the dentist (+1)"]);
  });
});
