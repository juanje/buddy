import type { ChatMessage } from "../../src/lib/chat-controller";
import type { AbWorld } from "./world";

export function allMessages(world: AbWorld): ChatMessage[] {
  return world.read(world.controller.messages) as ChatMessage[];
}

export function assistantBubbles(world: AbWorld): ChatMessage[] {
  return allMessages(world).filter((m) => m.role === "assistant");
}

export function toolActivityBlocks(world: AbWorld): ChatMessage[] {
  return allMessages(world).filter((m) => m.role === "tool-activity");
}
