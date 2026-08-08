// tests/unit/worker-connection.test.ts — NFR-REL-10: reconnecting releases the
// previous channel.
//
// The transport subscribes to a *global* Tauri event and filters by process
// name, so a discarded transport keeps receiving output from the next worker
// spawned under that name. Two live transports meant every event reached the
// frontend twice and the chat rendered each streamed delta twice. The contract
// under test is that connectWorker hands back the means to close what it opened.

import { beforeEach, describe, expect, it, vi } from "vitest";

const kill = vi.fn(async () => {});
const spawn = vi.fn(async () => {});
const unlistenExit = vi.fn();
const onExit = vi.fn(async () => unlistenExit);
const transportClose = vi.fn();
const createChannel = vi.fn(async () => ({
  channel: {},
  api: {},
  transport: { close: transportClose },
}));

vi.mock("tauri-plugin-js-api", () => ({ kill, spawn, onExit, createChannel }));

// Injected by Vite's `define` in the real build; the dev spawn path reads it.
vi.stubGlobal("__BUDDY_PROJECT_ROOT__", "/tmp/buddy-project");

const { connectWorker } = await import("../../src/utils/agent");

const frontend = {} as never;
const onCrash = () => {};

describe("connectWorker (NFR-REL-10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes a dispose that closes the transport", async () => {
    const connection = await connectWorker(frontend, onCrash);

    expect(transportClose).not.toHaveBeenCalled();
    await connection.dispose();
    expect(transportClose).toHaveBeenCalledTimes(1);
  });

  it("removes the crash listener on dispose", async () => {
    const connection = await connectWorker(frontend, onCrash);

    await connection.dispose();
    expect(unlistenExit).toHaveBeenCalledTimes(1);
  });

  it("survives a transport without close()", async () => {
    createChannel.mockResolvedValueOnce({ channel: {}, api: {}, transport: {} } as never);
    const connection = await connectWorker(frontend, onCrash);

    await expect(connection.dispose()).resolves.toBeUndefined();
  });

  it("is idempotent — a second dispose does not close twice", async () => {
    const connection = await connectWorker(frontend, onCrash);

    await connection.dispose();
    await connection.dispose();
    expect(transportClose).toHaveBeenCalledTimes(1);
    expect(unlistenExit).toHaveBeenCalledTimes(1);
  });
});
