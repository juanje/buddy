import { describe, expect, it } from "vitest";

import { chainToolHooks, type ToolHookSession } from "../../backends/tool-hooks";

const CTX = { toolCall: { name: "write" }, args: {} } as never;

describe("chainToolHooks", () => {
  it("passes the previously installed hook as prior, preserving call order", async () => {
    const calls: string[] = [];
    const session = {
      agent: {
        beforeToolCall: async () => {
          calls.push("original");
          return { block: true, reason: "original" };
        },
      },
    } as unknown as ToolHookSession;

    chainToolHooks(session, {
      before: async (ctx, signal, prior) => {
        calls.push("new-start");
        const result = await prior(ctx, signal);
        calls.push("new-end");
        return result;
      },
    });

    const result = await session.agent.beforeToolCall!(CTX, undefined);
    expect(calls).toEqual(["new-start", "original", "new-end"]);
    expect(result).toEqual({ block: true, reason: "original" });
  });

  it("supplies a no-op prior when no hook was installed", async () => {
    const session = { agent: {} } as ToolHookSession;
    chainToolHooks(session, { after: (ctx, signal, prior) => prior(ctx, signal) });
    expect(await session.agent.afterToolCall!(CTX, undefined)).toBeUndefined();
    expect(session.agent.beforeToolCall).toBeUndefined();
  });
});
