// src/lib/file-viewer-controller.ts — Inline file viewer state (FR-CHAT-10/12).

import { get, writable, type Readable } from "svelte/store";

import { basename } from "../utils/path";
import { splitFrontmatter } from "../../shared/frontmatter";
import { resolveViewablePath } from "../../shared/viewable-path";

export interface FileViewerDeps {
  /**
   * Read a viewable file by its path relative to the buddy directory. Backed by
   * worker RPC — the frontend has no filesystem capability (NFR-SEC-09).
   */
  readViewableFile(relPath: string): Promise<string>;
  /** Buddy directory, needed to resolve links found inside a document. */
  rootDir?: () => string;
}

export interface FileViewerController {
  open: Readable<boolean>;
  filePath: Readable<string>;
  fileName: Readable<string>;
  content: Readable<string>;
  /**
   * The `summary` frontmatter field of the open document, when it has one
   * (FR-CHAT-15). Undefined for plain text, for files without frontmatter, and
   * for frontmatter that declares no summary.
   */
  summary: Readable<string | undefined>;
  error: Readable<string | undefined>;
  isMarkdown: Readable<boolean>;
  loading: Readable<boolean>;
  /** True when there is a previously viewed document to return to (FR-CHAT-12). */
  canGoBack: Readable<boolean>;
  /** Open a file by path relative to the buddy directory. Starts a new history. */
  openFile(relPath: string): Promise<void>;
  /**
   * Follow a link found inside the document being viewed (FR-CHAT-12).
   * Resolved relative to that document; ignored when it resolves out of bounds.
   * Returns whether it was followed.
   */
  followLink(href: string): Promise<boolean>;
  /** Return to the previously viewed document. */
  back(): Promise<void>;
  close(): void;
}

export function createFileViewerController(deps: FileViewerDeps): FileViewerController {
  const openStore = writable(false);
  const filePathStore = writable("");
  const fileNameStore = writable("");
  const contentStore = writable("");
  const summaryStore = writable<string | undefined>(undefined);
  const errorStore = writable<string | undefined>(undefined);
  const isMarkdownStore = writable(false);
  const loadingStore = writable(false);
  const canGoBackStore = writable(false);

  /** Documents visited before the current one, most recent last. */
  let history: string[] = [];

  async function load(relPath: string): Promise<void> {
    openStore.set(true);
    filePathStore.set(relPath);
    fileNameStore.set(basename(relPath));
    const isMarkdown = /\.md$/i.test(relPath);
    isMarkdownStore.set(isMarkdown);
    contentStore.set("");
    summaryStore.set(undefined);
    errorStore.set(undefined);
    loadingStore.set(true);

    try {
      const text = await deps.readViewableFile(relPath);
      // Frontmatter is metadata, and markdown renders it as a rule plus a
      // setext heading — the biggest thing on the page (FR-CHAT-15). Plain text
      // has no such convention, so a .txt opening with dashes says exactly what
      // the user should see.
      if (isMarkdown) {
        const { fields, body } = splitFrontmatter(text);
        contentStore.set(body);
        summaryStore.set(fields.summary);
      } else {
        contentStore.set(text);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errorStore.set(message);
    } finally {
      loadingStore.set(false);
    }
  }

  async function openFile(relPath: string): Promise<void> {
    // Opening from the chat starts a fresh trail: the message is the origin.
    history = [];
    canGoBackStore.set(false);
    await load(relPath);
  }

  async function followLink(href: string): Promise<boolean> {
    const from = get(filePathStore);
    if (!from) return false;

    const rootDir = deps.rootDir?.() ?? "";
    // Links are written relative to the document holding them, so the current
    // path is the base. Containment is still enforced against rootDir.
    const target = resolveViewablePath(rootDir, href, from);
    if (!target || target === from) return false;

    history.push(from);
    canGoBackStore.set(true);
    await load(target);
    return true;
  }

  async function back(): Promise<void> {
    const previous = history.pop();
    if (previous === undefined) return;
    canGoBackStore.set(history.length > 0);
    await load(previous);
  }

  function close(): void {
    history = [];
    canGoBackStore.set(false);
    openStore.set(false);
    filePathStore.set("");
    fileNameStore.set("");
    contentStore.set("");
    summaryStore.set(undefined);
    errorStore.set(undefined);
    isMarkdownStore.set(false);
    loadingStore.set(false);
  }

  return {
    open: { subscribe: openStore.subscribe },
    filePath: { subscribe: filePathStore.subscribe },
    fileName: { subscribe: fileNameStore.subscribe },
    content: { subscribe: contentStore.subscribe },
    summary: { subscribe: summaryStore.subscribe },
    error: { subscribe: errorStore.subscribe },
    isMarkdown: { subscribe: isMarkdownStore.subscribe },
    loading: { subscribe: loadingStore.subscribe },
    canGoBack: { subscribe: canGoBackStore.subscribe },
    openFile,
    followLink,
    back,
    close,
  };
}
