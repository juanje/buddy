import type { ChatMessage } from "../../src/lib/chat-controller";
import type { BuddyWorld } from "./world";

export function allMessages(world: BuddyWorld): ChatMessage[] {
  return world.read(world.controller.messages) as ChatMessage[];
}

export function assistantBubbles(world: BuddyWorld): ChatMessage[] {
  return allMessages(world).filter((m) => m.role === "assistant");
}

export function toolActivityBlocks(world: BuddyWorld): ChatMessage[] {
  return allMessages(world).filter((m) => m.role === "tool-activity");
}
