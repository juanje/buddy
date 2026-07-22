// tests/unit/app-view.test.ts — view routing + locale bootstrap (NFR-I18N).

import { describe, expect, it } from "vitest";

import { applyLocaleFromSetup, resolveInitialView } from "../../src/lib/app-view";
import { getLocale, setLocale } from "../../src/lib/i18n";

describe("resolveInitialView", () => {
  it("routes first run to setup", () => {
    expect(resolveInitialView({ firstRun: true })).toBe("setup");
  });

  it("routes configured instance to chat", () => {
    expect(
      resolveInitialView({
        firstRun: false,
        config: {
          rootDir: "/tmp/ab",
          provider: "anthropic",
          model: "claude-haiku-4-5",
          language: "es",
        },
      }),
    ).toBe("chat");
  });
});

describe("applyLocaleFromSetup", () => {
  it("sets UI locale from persisted config", () => {
    setLocale("en");
    applyLocaleFromSetup({
      firstRun: false,
      config: {
        rootDir: "/tmp/ab",
        provider: "openai",
        model: "gpt-5",
        language: "es",
      },
    });
    expect(getLocale()).toBe("es");
  });

  it("defaults to Spanish when language is omitted", () => {
    setLocale("en");
    applyLocaleFromSetup({
      firstRun: false,
      config: {
        rootDir: "/tmp/ab",
        provider: "openai",
        model: "gpt-5",
      },
    });
    expect(getLocale()).toBe("es");
  });

  it("does not change locale on first run", () => {
    setLocale("en");
    applyLocaleFromSetup({ firstRun: true });
    expect(getLocale()).toBe("en");
    setLocale("es");
  });
});
