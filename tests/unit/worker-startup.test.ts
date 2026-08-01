// tests/unit/worker-startup.test.ts — nothing on the way to the RPC channel
// waits for the network (NFR-PERF-02).
//
// On 2026-08-01 `pi.dev`, which serves the Pi model catalogue, began accepting
// TCP connections and never answering. `createBuddyModelRuntime()` fetches from
// it, and the worker awaited that call before creating the channel, so every
// launch showed an empty window for 15 seconds — the abort timeout — with
// nothing in the logs to say why. Buddy's own availability had come to depend
// on a third party's.
//
// The property is an ordering one, and ordering is what unit tests of the parts
// cannot see: `createBuddyModelRuntime` was correct, the channel was correct,
// and the app was unusable. So this drives the real `main()` with a runtime that
// never resolves, and requires it to finish wiring anyway.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ModelRuntime } from "@earendil-works/pi-coding-agent";

let configDir: string;
let previousConfigDir: string | undefined;

beforeEach(() => {
  configDir = mkdtempSync(join(tmpdir(), "buddy-worker-startup-"));
  previousConfigDir = process.env.BUDDY_CONFIG_DIR;
  // An empty config dir means first run, so `main` wires the channel and
  // returns without opening a Pi session.
  process.env.BUDDY_CONFIG_DIR = configDir;
});

afterEach(() => {
  if (previousConfigDir === undefined) delete process.env.BUDDY_CONFIG_DIR;
  else process.env.BUDDY_CONFIG_DIR = previousConfigDir;
  rmSync(configDir, { recursive: true, force: true });
});

/** Streams that go nowhere: the test never speaks RPC, only observes wiring. */
function silentStreams() {
  return {
    readable: new Readable({ read() {} }),
    writable: new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    }),
  };
}

describe("worker startup", () => {
  it("wires the RPC channel without waiting for the model runtime", async () => {
    const { main } = await import("../../backends/agent-worker");

    let settled = false;
    const pending = new Promise<ModelRuntime>(() => {
      // Never resolves: this is the outage, reproduced.
    });

    const started = main({
      createModelRuntime: () => pending,
      streams: silentStreams(),
    }).then(() => {
      settled = true;
    });

    await Promise.race([
      started,
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);

    expect(
      settled,
      "main() did not finish wiring while the model runtime was pending — " +
        "something on the startup path awaits it, and a slow catalogue host " +
        "becomes an app that will not open.",
    ).toBe(true);
  });
});
