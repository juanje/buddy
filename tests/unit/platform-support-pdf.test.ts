// tests/unit/platform-support-pdf.test.ts — FR-CHAT-21 platform gating.

import { describe, expect, it } from "vitest";

import { platformSupportsPdf } from "../../src/lib/platform-support-pdf";

describe("platformSupportsPdf (FR-CHAT-21)", () => {
  it("enables PDF export on Linux user agents", () => {
    expect(
      platformSupportsPdf("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"),
    ).toBe(true);
  });

  it("enables PDF export on macOS user agents", () => {
    expect(
      platformSupportsPdf("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15"),
    ).toBe(true);
  });

  it("disables PDF export on Windows user agents", () => {
    expect(
      platformSupportsPdf("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"),
    ).toBe(false);
  });
});
