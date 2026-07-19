// tests/unit/i18n.test.ts — NFR-I18N locale switching.

import { describe, expect, it } from "vitest";
import { get } from "svelte/store";

import { getLocale, setLocale, t } from "../../src/lib/i18n";

describe("i18n", () => {
  it("defaults to Spanish", () => {
    setLocale("es");
    expect(getLocale()).toBe("es");
    expect(get(t).wizardTitle).toBe("Bienvenido a AB");
  });

  it("switches to English with setLocale", () => {
    setLocale("en");
    expect(getLocale()).toBe("en");
    expect(get(t).wizardTitle).toBe("Welcome to AB");
    setLocale("es");
  });
});
