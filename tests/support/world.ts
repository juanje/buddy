// tests/support/world.ts — Cucumber World for buddy BDD tests.
// Wires: FakeSession (Pi-shaped events) → worker core → chat controller.
// This is the same wiring the real app uses, minus kkrpc transport and DOM.

import { setWorldConstructor, World, type IWorldOptions } from "@cucumber/cucumber";
import { get } from "svelte/store";

import { FakeSession } from "./fake-session";
import { augmentPromptWithAttachments } from "../../backends/session-boot";
import { createWorkerCore, type WorkerCore } from "../../backends/worker-core";
import { SessionLifecycle } from "../../backends/session-lifecycle";
import type { SpawnReflectOptions } from "../../backends/reflect-spawn";
import type { PromptOptions } from "../../shared/api";
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

export class BuddyWorld extends World {
  session!: FakeSession;
  core!: WorkerCore;
  controller!: ChatController;
  scroll!: ScrollController;
  viewport: FakeViewport = { scrollTop: 0, scrollHeight: 0, clientHeight: 300 };

  /** DOM focus simulation (focus is a view concern; steps track it here). */
  inputFocused = false;

  /** Simulated textarea element for FR-CHAT-08 height reset. */
  mockTextarea = { style: { height: "auto" }, scrollHeight: 96 };

  /** Permission verdicts the controller sent to the worker (FR-PERM-07). */
  permissionResolutions: Array<{ id: number; allow: boolean }> = [];

  /** Id of the most recent simulated permission request. */
  lastPermissionId?: number;

  constructor(options: IWorldOptions) {
    super(options);
  }

  /** Optional buddy directory for memory-loop scenarios (FR-GIT-01+). */
  rootDir?: string;
  lifecycle?: SessionLifecycle;
  spawnCalls?: SpawnReflectOptions[];

  /** Background: "the app is running" + "the Pi SDK session is connected". */
  connect(
    rootDir?: string,
    options?: { force?: boolean; trackSpawn?: boolean },
  ): void {
    if (this.controller && !options?.force) return;
    this.rootDir = rootDir;
    this.session = new FakeSession();

    if (options?.trackSpawn) {
      this.spawnCalls = [];
    }

    this.lifecycle = rootDir
      ? new SessionLifecycle({
          rootDir,
          sessionId: "test-session",
          spawnReflect: options?.trackSpawn
            ? (spawnOptions) => {
                this.spawnCalls!.push(spawnOptions);
                return 1;
              }
            : undefined,
        })
      : undefined;

    // Frontend side: events route straight into the controller, exactly like
    // FrontendAPI.onAgentEvent does in src/utils/agent.ts.
    let controllerRef: ChatController | undefined;
    this.core = createWorkerCore(
      this.session,
      {
        onAgentEvent: (event) => controllerRef?.handleEvent(event),
        onWorkerError: () => {},
        onPermissionRequest: (request) => controllerRef?.handlePermissionRequest(request),
        onOAuthEvent: () => {},
        onDeferredDue: () => {},
        onBudgetAlert: () => {},
      },
      { lifecycle: this.lifecycle },
    );
    // The session core lacks resolvePermission (it lives in the worker entry
    // point); the world records verdicts like the real RPC would deliver them.
    const self = this;
    this.controller = createChatController({
      ...this.core.api,
      async prompt(text: string, options?: PromptOptions) {
        const sessionAllowedPaths = new Set<string>();
        const augmented = await augmentPromptWithAttachments(text, sessionAllowedPaths, options);
        await self.core.api.prompt(
          augmented.text,
          augmented.images ? { images: augmented.images } : undefined,
        );
      },
      resolvePermission: async (id, allow) => {
        self.permissionResolutions.push({ id, allow });
      },
      dismissDeferredItems: async () => {},
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

setWorldConstructor(BuddyWorld);
