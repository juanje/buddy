// tests/unit/prompt-queue.test.ts — FR-CHAT-13.
//
// `prompt()` in the worker read:
//
//     await core?.api.prompt(augmented.text, …)
//
// `core` does not exist until `bootSession` resolves. Optional chaining made
// that silent: the expression evaluates to undefined, `await undefined`
// resolves immediately, and prompt() returns success having done nothing. The
// frontend renders the user's bubble and waits for a reply nobody asked for.
//
// Observed 2026-07-28. Session boot performs a full LLM call — the silent
// context injection, ~17.7k tokens, whose response is discarded by design — and
// the worker core is only created after it completes. On a commercial provider
// that window is 1–3 seconds and nobody notices. Against a local model it was
// 81 seconds, and the message typed into a UI that looked entirely ready was
// dropped without a trace in any log.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createPromptQueue } from "../../backends/prompt-queue";

describe("createPromptQueue", () => {
  it("delivers straight through once the session is ready", async () => {
    const sent: string[] = [];
    const queue = createPromptQueue();
    queue.ready(async (text) => {
      sent.push(text);
    });

    await queue.submit("hola");
    expect(sent).toEqual(["hola"]);
  });

  it("holds a prompt sent before the session exists, then delivers it", async () => {
    const sent: string[] = [];
    const queue = createPromptQueue();

    await queue.submit("hola"); // arrives during boot
    expect(sent).toEqual([]); // nothing lost, nothing sent yet

    await queue.ready(async (text) => {
      sent.push(text);
    });
    expect(sent).toEqual(["hola"]);
  });

  it("preserves order across several queued prompts", async () => {
    const sent: string[] = [];
    const queue = createPromptQueue();

    await queue.submit("uno");
    await queue.submit("dos");
    await queue.submit("tres");

    await queue.ready(async (text) => {
      sent.push(text);
    });
    expect(sent).toEqual(["uno", "dos", "tres"]);
  });

  it("carries the options each prompt was sent with", async () => {
    // Attachments and images belong to their own message; flushing must not
    // pair a prompt with another's images.
    const sent: Array<[string, unknown]> = [];
    const queue = createPromptQueue();

    await queue.submit("con imagen", { images: [{ type: "image", data: "x", mimeType: "image/png" }] });
    await queue.submit("sin nada");

    await queue.ready(async (text, options) => {
      sent.push([text, options]);
    });

    expect(sent[0]![0]).toBe("con imagen");
    expect(sent[0]![1]).toMatchObject({ images: [{ data: "x" }] });
    expect(sent[1]![1]).toBeUndefined();
  });

  it("reports whether anything is waiting", async () => {
    const queue = createPromptQueue();
    expect(queue.pending()).toBe(0);
    await queue.submit("hola");
    expect(queue.pending()).toBe(1);
    await queue.ready(async () => {});
    expect(queue.pending()).toBe(0);
  });

  it("does not replay the queue when the session is replaced", async () => {
    // A session restart must not resend what the previous one already handled.
    const first: string[] = [];
    const second: string[] = [];
    const queue = createPromptQueue();

    await queue.submit("hola");
    await queue.ready(async (text) => {
      first.push(text);
    });
    await queue.ready(async (text) => {
      second.push(text);
    });

    expect(first).toEqual(["hola"]);
    expect(second).toEqual([]);
  });

  it("surfaces a delivery failure rather than swallowing it", async () => {
    const queue = createPromptQueue();
    await queue.submit("hola");
    await expect(
      queue.ready(async () => {
        throw new Error("session died");
      }),
    ).rejects.toThrow("session died");
  });
});

// ---------------------------------------------------------------------------
// The wiring. Everything above proves the queue; none of it proves the worker
// uses one — which is exactly how `core?.api.prompt(...)` survived review. A
// source check is the honest instrument here: the worker's prompt handler is
// buried in an RPC object literal built inside main(), and constructing it in a
// test would mean booting a Pi session.
// ---------------------------------------------------------------------------

describe("the worker never calls the session prompt optionally", () => {
  const source = readFileSync(
    join(import.meta.dirname, "..", "..", "backends", "agent-worker.ts"),
    "utf8",
  ).replace(/^\s*\/\/.*$/gm, "");

  it("routes user prompts through the queue", () => {
    expect(source).toMatch(/promptQueue\.submit\(/);
  });

  it("has no optional call to core?.api.prompt", () => {
    // The defect itself: `await core?.api.prompt(...)` resolves to undefined
    // when core is absent, so the prompt is discarded and success is reported.
    expect(source).not.toMatch(/core\?\.\s*api\s*\.\s*prompt\s*\(/);
  });

  it("flushes the queue once the session is up", () => {
    expect(source).toMatch(/promptQueue\.ready\(/);
  });
});
