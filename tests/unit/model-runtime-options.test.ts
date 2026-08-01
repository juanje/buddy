// tests/unit/model-runtime-options.test.ts — NFR-REL-09 for the model catalogue.
//
// On 2026-08-01 `pi.dev` began accepting connections and never answering. The
// SDK bounds that refresh at 15s by default, which is a CLI's patience: Buddy
// paid it on every launch, in front of a window that could not paint.
//
// Both options are asserted, and the second is the one that is easy to argue
// away as redundant. `allowModelNetwork` defaults to on in the installed 0.80,
// and by 0.83 the same refresh only runs when the option is explicitly true —
// so an SDK upgrade would silently stop refreshing the catalogue. Stating it
// costs a line; discovering it costs a release where model lists quietly go
// stale.
//
// The options are checked rather than the timing: asserting "startup finishes
// within N seconds" would pass or fail on whether pi.dev happens to be up.

import { afterEach, describe, expect, it, vi } from "vitest";

import { MODEL_CATALOG_REFRESH_TIMEOUT_MS } from "../../shared/defaults";

type CreateOptions = Record<string, unknown>;
const create = vi.hoisted(() =>
  vi.fn(async (_options: Record<string, unknown>) => ({}) as never),
);

vi.mock("@earendil-works/pi-coding-agent", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, ModelRuntime: { create } };
});

afterEach(() => {
  create.mockClear();
});

async function optionsUsed(): Promise<CreateOptions> {
  const { createBuddyModelRuntime } = await import("../../backends/provider-auth");
  await createBuddyModelRuntime();
  expect(create).toHaveBeenCalledOnce();
  const [options] = create.mock.calls[0] ?? [];
  return (options ?? {}) as CreateOptions;
}

describe("the model runtime Buddy asks for", () => {
  it("bounds the catalogue refresh well below the SDK default of 15s", async () => {
    const options = await optionsUsed();
    expect(options.modelRefreshTimeoutMs).toBe(MODEL_CATALOG_REFRESH_TIMEOUT_MS);
    expect(MODEL_CATALOG_REFRESH_TIMEOUT_MS).toBeLessThan(15_000);
  });

  it("asks for the network refresh explicitly, not by inheriting a default", async () => {
    expect((await optionsUsed()).allowModelNetwork).toBe(true);
  });

  it("still keeps its catalogue out of the Pi CLI's config (NFR-SEC-19)", async () => {
    const options = await optionsUsed();
    expect(options.modelsPath).toBeTruthy();
    expect(options.modelsStorePath).toBeTruthy();
    expect(String(options.modelsPath)).not.toContain("/.pi/");
    expect(String(options.modelsStorePath)).not.toContain("/.pi/");
  });
});
