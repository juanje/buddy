// backends/tool-hooks.ts — chain beforeToolCall / afterToolCall hooks on a Pi session.
//
// Every guard (permission gate, heading guard, hebbian guard, edit recovery)
// wraps whatever hook is already installed. The helper only does the wrapping;
// each hook receives the previous one as `prior` and decides whether to call it
// before or after its own logic, and what to return.

import type { createAgentSession } from "@earendil-works/pi-coding-agent";

type Agent = Awaited<ReturnType<typeof createAgentSession>>["session"]["agent"];

/**
 * Just the part of a Pi session the hooks touch, derived from the SDK's own
 * type so a signature change upstream fails the build here.
 */
export interface ToolHookSession {
  agent: Pick<Agent, "beforeToolCall" | "afterToolCall">;
}

export type BeforeToolHook = NonNullable<Agent["beforeToolCall"]>;
export type AfterToolHook = NonNullable<Agent["afterToolCall"]>;

type Params<F> = F extends (...args: infer P) => unknown ? P : never;

export interface ToolHooks {
  before?: (
    ctx: Params<BeforeToolHook>[0],
    signal: AbortSignal | undefined,
    prior: BeforeToolHook,
  ) => ReturnType<BeforeToolHook>;
  after?: (
    ctx: Params<AfterToolHook>[0],
    signal: AbortSignal | undefined,
    prior: AfterToolHook,
  ) => ReturnType<AfterToolHook>;
}

/** The target path of a `write` or `edit` call, or undefined for any other call. */
export function writeTargetPath(ctx: { toolCall: { name: string }; args: unknown }): string | undefined {
  const name = ctx.toolCall.name;
  if (name !== "write" && name !== "edit") return undefined;
  const path = (ctx.args as Record<string, unknown>)?.path;
  return typeof path === "string" ? path : undefined;
}

/**
 * Install `hooks` on the session, preserving any hook already there as `prior`
 * (a no-op returning `undefined` when there was none).
 */
export function chainToolHooks(session: ToolHookSession, hooks: ToolHooks): void {
  const { before, after } = hooks;
  if (before) {
    const original = session.agent.beforeToolCall;
    const prior: BeforeToolHook = async (ctx, signal) => original?.(ctx, signal);
    session.agent.beforeToolCall = (ctx, signal) => before(ctx, signal, prior);
  }
  if (after) {
    const original = session.agent.afterToolCall;
    const prior: AfterToolHook = async (ctx, signal) => original?.(ctx, signal);
    session.agent.afterToolCall = (ctx, signal) => after(ctx, signal, prior);
  }
}
