// tests/unit/chat-display-controller.test.ts — FR-CHAT-05/06 controller behavior.

import { describe, expect, it } from "vitest";
import { get } from "svelte/store";

import { createChatController, type ChatMessage } from "../../src/lib/chat-controller";
import type { AgentEvent } from "../../shared/api";

function fakeWorker() {
  return {
    prompt: async () => {},
    abort: async () => {},
    resolvePermission: async () => {},
    dismissDeferredItems: async () => {},
    shutdown: async () => {},
  };
}

function emit(controller: ReturnType<typeof createChatController>, event: AgentEvent): void {
  controller.handleEvent(event);
}

describe("chat controller display polish", () => {
  it("accumulates tool calls into one activity block", () => {
    const controller = createChatController(fakeWorker());
    emit(controller, { type: "agent_start" });
    emit(controller, {
      type: "tool_execution_start",
      toolCall: { name: "read", args: { path: "/tmp/a.md" } },
    });
    emit(controller, {
      type: "tool_execution_end",
      toolCall: { name: "read", args: { path: "/tmp/a.md" } },
    });
    emit(controller, {
      type: "tool_execution_start",
      toolCall: { name: "grep", args: {} },
    });

    const messages = get(controller.messages) as ChatMessage[];
    const block = messages.find((m) => m.role === "tool-activity");
    expect(block?.toolCalls?.length).toBe(2);
    expect(block?.toolCalls?.[0].status).toBe("done");
    expect(block?.toolCalls?.[1].status).toBe("running");
  });

  it("attaches thinking to the assistant bubble on first text delta", () => {
    const controller = createChatController(fakeWorker());
    emit(controller, { type: "agent_start" });
    emit(controller, {
      type: "message_update",
      assistantMessageEvent: { type: "thinking_delta", delta: "Hmm…" },
    });
    emit(controller, {
      type: "message_update",
      assistantMessageEvent: { type: "text_delta", delta: "Answer" },
    });

    const assistant = get(controller.messages).find((m) => m.role === "assistant");
    expect(assistant?.thinking).toBe("Hmm…");
    expect(assistant?.text).toBe("Answer");
  });

  it("hides welcome banner after send", async () => {
    const controller = createChatController(fakeWorker());
    expect(get(controller.welcomeVisible)).toBe(true);
    controller.input.set("Hi");
    await controller.send();
    expect(get(controller.welcomeVisible)).toBe(false);
  });

  it("dismissWelcome calls worker dismissDeferredItems", async () => {
    let dismissed = false;
    const controller = createChatController({
      ...fakeWorker(),
      dismissDeferredItems: async () => {
        dismissed = true;
      },
    });
    controller.dismissWelcome();
    await Promise.resolve();
    expect(dismissed).toBe(true);
    expect(get(controller.welcomeVisible)).toBe(false);
  });
});
