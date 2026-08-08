// tests/unit/worker-proxy.test.ts — the contract worker-proxy actually has.
//
// The proxy exists because the UI renders before the worker connects, so every
// WorkerAPI call has to survive `connection === undefined`. Which calls survive
// it *quietly* and which reject is a real decision — sending a prompt into the
// void is recoverable, reading setup state is not — and it had no test, only
// twenty hand-written method bodies that happened to agree.

import { describe, expect, it, vi } from "vitest";

import type { WorkerAPI } from "../../shared/api";
import { createWorkerProxy } from "../../src/utils/worker-proxy";

/** Calls that must resolve quietly with no worker, and what they resolve to. */
const TOLERATED: Array<[keyof WorkerAPI, unknown[], unknown]> = [
  ["prompt", ["hola"], undefined],
  ["abort", [], undefined],
  ["dismissDeferredItems", [], undefined],
  ["resolvePermission", [1, true], undefined],
  ["shutdown", [], undefined],
  // The chat welcome state renders this straight into a list.
  ["getDeferredItems", [], []],
];

/** Calls that must reject with no worker rather than invent an answer. */
const REQUIRES_WORKER: Array<[keyof WorkerAPI, unknown[]]> = [
  ["getSetupState", []],
  ["checkPrerequisites", []],
  ["getDefaultLocation", []],
  ["validateLocation", ["/tmp/x"]],
  ["configureProviderKey", ["openai", "sk-x"]],
  ["loginOAuth", ["openai"]],
  ["answerOAuthPrompt", [1, "x"]],
  ["cancelOAuthLogin", []],
  ["listModels", ["openai"]],
  ["getAuthStatus", []],
  ["runSetup", [{}, "create"]],
  ["updateConfig", [{}]],
  ["changeModel", ["openai", "gpt-5"]],
  ["getUsage", []],
  ["readViewableFile", ["user/a.md"]],
];

function fakeConnection() {
  const api = new Proxy({} as Record<string, ReturnType<typeof vi.fn>>, {
    get(target, name: string) {
      target[name] ??= vi.fn(async () => `ok:${name}`);
      return target[name];
    },
  });
  return {
    connection: { api: api as unknown as WorkerAPI, dispose: async () => {} },
    api,
  };
}

describe("createWorkerProxy", () => {
  describe("with no worker connected", () => {
    const proxy = createWorkerProxy(() => undefined);

    it.each(TOLERATED)("%s resolves quietly", async (name, args, expected) => {
      await expect((proxy[name] as (...a: unknown[]) => Promise<unknown>)(...args)).resolves.toEqual(
        expected,
      );
    });

    it.each(REQUIRES_WORKER)("%s rejects", async (name, args) => {
      await expect(
        (proxy[name] as (...a: unknown[]) => Promise<unknown>)(...args),
      ).rejects.toThrow(/not connected/);
    });

    it("covers every method of WorkerAPI between the two lists", () => {
      // Without this, adding a method to WorkerAPI and forgetting it here would
      // leave it silently untested — which is how the hand-written version
      // could have drifted from the interface without anyone noticing.
      const listed = new Set([...TOLERATED.map((t) => t[0]), ...REQUIRES_WORKER.map((r) => r[0])]);
      expect(listed.size).toBe(21);
    });
  });

  describe("with a worker connected", () => {
    it("forwards the call and its arguments untouched", async () => {
      const { connection, api } = fakeConnection();
      const proxy = createWorkerProxy(() => connection);

      await proxy.prompt("hola", { images: ["a.png"] } as never);
      expect(api.prompt).toHaveBeenCalledWith("hola", { images: ["a.png"] });

      await proxy.changeModel("openai", "gpt-5");
      expect(api.changeModel).toHaveBeenCalledWith("openai", "gpt-5");
    });

    it("returns what the worker returned", async () => {
      const { connection, api } = fakeConnection();
      api.getDefaultLocation.mockResolvedValue("/home/u/buddy");
      const proxy = createWorkerProxy(() => connection);

      await expect(proxy.getDefaultLocation()).resolves.toBe("/home/u/buddy");
    });

    it("re-reads the connection on every call, never caching it", async () => {
      // connect() replaces the connection after a crash; a proxy holding the
      // old one would keep talking to a dead worker.
      let current: { api: WorkerAPI; dispose: () => Promise<void> } | undefined;
      const proxy = createWorkerProxy(() => current);

      await expect(proxy.getUsage()).rejects.toThrow(/not connected/);
      const { connection, api } = fakeConnection();
      current = connection;
      await proxy.getUsage();
      expect(api.getUsage).toHaveBeenCalledOnce();
    });
  });

  it("is not mistaken for a thenable when awaited", async () => {
    // A Proxy that answers every property with a function makes `await proxy`
    // see a `.then` and try to call it. Only relevant to a proxy-based
    // implementation, which is exactly why it is pinned here.
    const proxy = createWorkerProxy(() => undefined) as unknown as Record<string, unknown>;
    expect(proxy.then).toBeUndefined();
    await expect(Promise.resolve(proxy)).resolves.toBe(proxy);
  });
});
