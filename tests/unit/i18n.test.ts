// tests/unit/i18n.test.ts — NFR-I18N locale switching.

import { describe, expect, it } from "vitest";
import { get } from "svelte/store";

import { getLocale, setLocale, t } from "../../src/lib/i18n";

describe("i18n", () => {
  it("can be set to Spanish", () => {
    setLocale("es");
    expect(getLocale()).toBe("es");
    expect(get(t).wizardTitle).toBe("Bienvenido a Buddy");
  });

  it("switches to English with setLocale", () => {
    setLocale("en");
    expect(getLocale()).toBe("en");
    expect(get(t).wizardTitle).toBe("Welcome to Buddy");
    setLocale("es");
  });

  it("has a task-remove permission title distinct from outside title", () => {
    setLocale("es");
    const es = get(t);
    expect(es.permissionTitleTaskRemove).toBeDefined();
    expect(es.permissionTitleTaskRemove).not.toBe(es.permissionTitleOutside);

    setLocale("en");
    const en = get(t);
    expect(en.permissionTitleTaskRemove).toBeDefined();
    expect(en.permissionTitleTaskRemove).not.toBe(en.permissionTitleOutside);
    setLocale("es");
  });
});
