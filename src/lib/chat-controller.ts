// src/lib/chat-controller.ts — framework-agnostic chat logic.
// Svelte components are thin views over these stores; BDD step definitions
// drive this controller directly. Built out feature by feature:
//   FR-CHAT-02 input/send
//   FR-CHAT-01 streaming display (token-by-token + typing indicator)
//   FR-CHAT-03 abort generation (button + Escape, partial text kept)

import { derived, get, writable, type Readable, type Writable } from "svelte/store";
import type {
  AgentEvent,
  AssistantMessageEventLike,
  ChatWorkerAPI,
  PermissionRequest,
} from "../../shared/api";

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
}

/** A permission question rendered inline in the chat (FR-PERM-07). */
export interface PermissionCard {
  request: PermissionRequest;
  verdict?: "allowed" | "denied";
}

export interface ChatController {
  /** Message transcript (user + assistant bubbles). */
  messages: Readable<ChatMessage[]>;
  /** Current input bar value. */
  input: Writable<string>;
  /** True while the agent is generating (agent_start → agent_end). */
  streaming: Readable<boolean>;
  /** Input bar disabled while a response streams (FR-CHAT-02). */
  inputDisabled: Readable<boolean>;
  /** Send allowed only with non-empty input and no active stream. */
  canSend: Readable<boolean>;
  /** Abort button shown instead of send while streaming. */
  showAbort: Readable<boolean>;
  /** Typing indicator: visible from agent_start until agent_end (FR-CHAT-01). */
  typingIndicator: Readable<boolean>;
  /** Permission questions shown inline in the chat (FR-PERM-07). */
  permissions: Readable<PermissionCard[]>;

  /** Send current input as a user message (no-op if canSend is false). */
  send(): Promise<void>;
  /** Abort the in-flight generation. Partial text stays in the transcript. */
  abort(): Promise<void>;
  /** Escape key: abort while streaming, no-op when idle (FR-CHAT-03). */
  onEscape(): Promise<void>;
  /** Route a Pi session event into the stores. */
  handleEvent(event: AgentEvent): void;
  /** A tool call is waiting for the user's decision (FR-PERM-07). */
  handlePermissionRequest(request: PermissionRequest): void;
  /** Answer a pending permission card. */
  respondPermission(id: number, allow: boolean): Promise<void>;
}

export function createChatController(worker: ChatWorkerAPI): ChatController {
  let nextId = 1;

  const messages = writable<ChatMessage[]>([]);
  const input = writable("");
  const streaming = writable(false);

  const inputDisabled = derived(streaming, ($s) => $s);
  const canSend = derived(
    [input, streaming],
    ([$input, $s]) => $input.trim().length > 0 && !$s,
  );
  const showAbort = derived(streaming, ($s) => $s);
  const typingIndicator = derived(streaming, ($s) => $s);

  // Id of the assistant bubble currently receiving deltas. The bubble is
  // created lazily on the FIRST text_delta so empty responses never produce
  // an empty bubble (FR-CHAT-01).
  let streamingBubbleId: number | null = null;

  async function send(): Promise<void> {
    if (!get(canSend)) return;
    const text = get(input);
    messages.update((list) => [...list, { id: nextId++, role: "user", text }]);
    input.set("");
    await worker.prompt(text);
  }

  async function abort(): Promise<void> {
    await worker.abort();
    // The session emits agent_end after aborting; streaming/bubble state is
    // cleared by handleEvent. Partial text already appended stays untouched.
  }

  async function onEscape(): Promise<void> {
    if (!get(streaming)) return; // idle → Escape does nothing
    await abort();
  }

  function appendAssistantText(delta: string): void {
    if (streamingBubbleId === null) {
      const id = nextId++;
      streamingBubbleId = id;
      messages.update((list) => [...list, { id, role: "assistant", text: delta }]);
      return;
    }
    messages.update((list) =>
      list.map((m) => (m.id === streamingBubbleId ? { ...m, text: m.text + delta } : m)),
    );
  }

  function handleEvent(event: AgentEvent): void {
    switch (event.type) {
      case "agent_start":
        streaming.set(true);
        break;
      case "message_update": {
        const sub = event.assistantMessageEvent as AssistantMessageEventLike | undefined;
        if (sub?.type === "text_delta" && typeof sub.delta === "string") {
          appendAssistantText(sub.delta);
        }
        break;
      }
      case "message_end":
        streamingBubbleId = null;
        break;
      case "agent_end":
        streamingBubbleId = null;
        streaming.set(false);
        break;
    }
  }

  const permissions = writable<PermissionCard[]>([]);

  function handlePermissionRequest(request: PermissionRequest): void {
    permissions.update((cards) => [...cards, { request }]);
  }

  async function respondPermission(id: number, allow: boolean): Promise<void> {
    await worker.resolvePermission(id, allow);
    permissions.update((cards) =>
      cards.map((card) =>
        card.request.id === id ? { ...card, verdict: allow ? "allowed" : "denied" } : card,
      ),
    );
  }

  return {
    messages,
    input,
    streaming,
    inputDisabled,
    canSend,
    showAbort,
    typingIndicator,
    permissions,
    send,
    abort,
    onEscape,
    handleEvent,
    handlePermissionRequest,
    respondPermission,
  };
}
