// tests/unit/resolve-import-provider.test.ts — resolveImportProvider, hoisted
// out of createSetupController (FR-SETUP-10 import).
//
// It closed over nothing but a module-level constant, so hoisting it changes
// no behaviour — this is the same function, just reachable without building a
// controller or a worker fake first.

import { describe, expect, it } from "vitest";

import { resolveImportProvider } from "../../src/lib/setup-controller";

describe("resolveImportProvider", () => {
  it("maps a Pi provider id to Buddy's own id", () => {
    expect(resolveImportProvider("anthropic")).toBe("anthropic");
    expect(resolveImportProvider("openai-codex")).toBe("openai");
  });

  it("accepts a Buddy provider id directly when it's not a Pi id", () => {
    // "custom" is a known Buddy provider but not one fromPiProviderId maps.
    expect(resolveImportProvider("custom")).toBe("custom");
  });

  it("returns undefined for an unrecognized provider string", () => {
    expect(resolveImportProvider("some-unknown-provider")).toBeUndefined();
  });

  it("returns undefined when there is nothing to resolve", () => {
    expect(resolveImportProvider(undefined)).toBeUndefined();
  });
});
