// src/lib/chat-controller.ts — framework-agnostic chat logic.
// Svelte components are thin views over these stores; BDD step definitions
// drive this controller directly. Built out feature by feature:
//   FR-CHAT-02 input/send
//   FR-CHAT-01 streaming display (token-by-token + typing indicator)
//   FR-CHAT-03 abort generation (button + Escape, partial text kept)
//   FR-INGEST-01..04 file attachments

import { derived, get, writable, type Readable, type Writable } from "svelte/store";
import { basename } from "node:path";
import type {
  AgentEvent,
  AssistantMessageEventLike,
  ChatWorkerAPI,
  PermissionRequest,
  PromptOptions,
} from "../../shared/api";
import { isSupportedIngestFormat } from "../../shared/ingest-formats";

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
}

/** Pending file attachment chip (FR-INGEST-01/02). */
export interface Attachment {
  path: string;
  name: string;
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
  /** Pending file attachments (FR-INGEST). */
  attachments: Writable<Attachment[]>;
  /** Rejected attachment filenames (FR-INGEST-04). */
  attachmentErrors: Readable<string[]>;
  /** True while the agent is generating (agent_start → agent_end). */
  streaming: Readable<boolean>;
  /** Input bar disabled while a response streams (FR-CHAT-02). */
  inputDisabled: Readable<boolean>;
  /** Send allowed with text and/or attachments when not streaming. */
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
  /** Add files by path (drag/drop or file picker). */
  addAttachments(paths: string[]): void;
  /** Remove a pending attachment before send. */
  removeAttachment(path: string): void;
  /** Clear attachment error toasts. */
  clearAttachmentErrors(): void;
  /** Route a Pi session event into the stores. */
  handleEvent(event: AgentEvent): void;
  /** A tool call is waiting for the user's decision (FR-PERM-07). */
  handlePermissionRequest(request: PermissionRequest): void;
  /** Answer a pending permission card. */
  respondPermission(id: number, allow: boolean): Promise<void>;
  /** Remove a resolved permission card from the list (dismiss). */
  dismissPermission(id: number): void;
}

export function createChatController(worker: ChatWorkerAPI): ChatController {
  let nextId = 1;

  const messages = writable<ChatMessage[]>([]);
  const input = writable("");
  const attachments = writable<Attachment[]>([]);
  const attachmentErrors = writable<string[]>([]);
  const streaming = writable(false);

  const inputDisabled = derived(streaming, ($s) => $s);
  const canSend = derived(
    [input, streaming, attachments],
    ([$input, $s, $attachments]) =>
      ($input.trim().length > 0 || $attachments.length > 0) && !$s,
  );
  const showAbort = derived(streaming, ($s) => $s);
  const typingIndicator = derived(streaming, ($s) => $s);

  // Id of the assistant bubble currently receiving deltas. The bubble is
  // created lazily on the FIRST text_delta so empty responses never produce
  // an empty bubble (FR-CHAT-01).
  let streamingBubbleId: number | null = null;

  function addAttachments(paths: string[]): void {
    const rejected: string[] = [];
    const accepted: Attachment[] = [];

    for (const path of paths) {
      const name = basename(path);
      if (!isSupportedIngestFormat(path)) {
        rejected.push(name);
        continue;
      }
      if (get(attachments).some((a) => a.path === path)) continue;
      accepted.push({ path, name });
    }

    if (accepted.length > 0) {
      attachments.update((list) => [...list, ...accepted]);
    }
    if (rejected.length > 0) {
      attachmentErrors.update((list) => [...list, ...rejected]);
    }
  }

  function removeAttachment(path: string): void {
    attachments.update((list) => list.filter((a) => a.path !== path));
  }

  function clearAttachmentErrors(): void {
    attachmentErrors.set([]);
  }

  async function send(): Promise<void> {
    if (!get(canSend)) return;
    const text = get(input).trim();
    const pending = get(attachments);
    const attachmentPaths = pending.map((a) => a.path);

    const displayText =
      text ||
      (attachmentPaths.length === 1
        ? `[Attached: ${pending[0].name}]`
        : `[Attached: ${attachmentPaths.length} files]`);

    messages.update((list) => [...list, { id: nextId++, role: "user", text: displayText }]);
    input.set("");
    attachments.set([]);

    const options: PromptOptions | undefined = attachmentPaths.length
      ? { attachments: attachmentPaths }
      : undefined;
    await worker.prompt(text, options);
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

  function dismissPermission(id: number): void {
    permissions.update((cards) => cards.filter((card) => card.request.id !== id));
  }

  return {
    messages,
    input,
    attachments,
    attachmentErrors,
    streaming,
    inputDisabled,
    canSend,
    showAbort,
    typingIndicator,
    permissions,
    send,
    abort,
    onEscape,
    addAttachments,
    removeAttachment,
    clearAttachmentErrors,
    handleEvent,
    handlePermissionRequest,
    respondPermission,
    dismissPermission,
  };
}
