// tests/support/world.ts — Cucumber World for AB App BDD tests.
// Wires: FakeSession (Pi-shaped events) → worker core → chat controller.
// This is the same wiring the real app uses, minus kkrpc transport and DOM.

import { setWorldConstructor, World, type IWorldOptions } from "@cucumber/cucumber";
import { get } from "svelte/store";

import { FakeSession } from "./fake-session";
import { createWorkerCore, type WorkerCore } from "../../backends/worker-core";
import {
  createChatController,
  type ChatController,
  type ChatMessage,
} from "../../src/lib/chat-controller";
import {
  createScrollController,
  type ScrollController,
} from "../../src/lib/scroll-controller";

/** Simulated scroll viewport (the real one is the ChatView DOM element). */
export interface FakeViewport {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

export class AbWorld extends World {
  session!: FakeSession;
  core!: WorkerCore;
  controller!: ChatController;
  scroll!: ScrollController;
  viewport: FakeViewport = { scrollTop: 0, scrollHeight: 0, clientHeight: 300 };

  /** DOM focus simulation (focus is a view concern; steps track it here). */
  inputFocused = false;

  /** Permission verdicts the controller sent to the worker (FR-PERM-07). */
  permissionResolutions: Array<{ id: number; allow: boolean }> = [];

  /** Id of the most recent simulated permission request. */
  lastPermissionId?: number;

  constructor(options: IWorldOptions) {
    super(options);
  }

  /** Background: "the app is running" + "the Pi SDK session is connected". */
  connect(): void {
    if (this.controller) return;
    this.session = new FakeSession();

    // Frontend side: events route straight into the controller, exactly like
    // FrontendAPI.onAgentEvent does in src/utils/agent.ts.
    let controllerRef: ChatController | undefined;
    this.core = createWorkerCore(this.session, {
      onAgentEvent: (event) => controllerRef?.handleEvent(event),
      onWorkerError: () => {},
      onPermissionRequest: (request) => controllerRef?.handlePermissionRequest(request),
    });
    // The session core lacks resolvePermission (it lives in the worker entry
    // point); the world records verdicts like the real RPC would deliver them.
    this.controller = createChatController({
      ...this.core.api,
      resolvePermission: async (id, allow) => {
        this.permissionResolutions.push({ id, allow });
      },
    });
    controllerRef = this.controller;

    // Scroll controller wired to the simulated viewport, mirroring ChatView:
    // content growth → notifyContentGrown(); scrollToLatest jumps to bottom.
    this.scroll = createScrollController(() => {
      this.viewport.scrollTop = Math.max(
        0,
        this.viewport.scrollHeight - this.viewport.clientHeight,
      );
    });

    // Content size tracks the transcript, like the DOM does. Each message
    // contributes height proportional to its text length.
    this.controller.messages.subscribe((list: ChatMessage[]) => {
      this.viewport.scrollHeight = list.reduce(
        (h, m) => h + 40 + Math.ceil(m.text.length / 60) * 20,
        0,
      );
      this.scroll.notifyContentGrown();
    });

    // The app focuses the input bar as soon as the chat view mounts.
    this.inputFocused = true;
  }

  /** Read a store value synchronously. */
  read<T>(store: { subscribe: (run: (value: T) => void) => () => void }): T {
    return get(store as never) as T;
  }
}

setWorldConstructor(AbWorld);
