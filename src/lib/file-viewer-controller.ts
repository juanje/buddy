// src/lib/file-viewer-controller.ts — Inline file viewer state (FR-CHAT-10).

import { writable, type Readable } from "svelte/store";

import { basename } from "../utils/path";

export interface FileViewerDeps {
  /**
   * Read a viewable file by its path relative to the buddy directory. Backed by
   * worker RPC — the frontend has no filesystem capability (NFR-SEC-09).
   */
  readViewableFile(relPath: string): Promise<string>;
}

export interface FileViewerController {
  open: Readable<boolean>;
  filePath: Readable<string>;
  fileName: Readable<string>;
  content: Readable<string>;
  error: Readable<string | undefined>;
  isMarkdown: Readable<boolean>;
  loading: Readable<boolean>;
  /** Open a file by path relative to the buddy directory. */
  openFile(relPath: string): Promise<void>;
  close(): void;
}

export function createFileViewerController(deps: FileViewerDeps): FileViewerController {
  const openStore = writable(false);
  const filePathStore = writable("");
  const fileNameStore = writable("");
  const contentStore = writable("");
  const errorStore = writable<string | undefined>(undefined);
  const isMarkdownStore = writable(false);
  const loadingStore = writable(false);

  async function openFile(relPath: string): Promise<void> {
    openStore.set(true);
    filePathStore.set(relPath);
    fileNameStore.set(basename(relPath));
    isMarkdownStore.set(/\.md$/i.test(relPath));
    contentStore.set("");
    errorStore.set(undefined);
    loadingStore.set(true);

    try {
      const text = await deps.readViewableFile(relPath);
      contentStore.set(text);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errorStore.set(message);
    } finally {
      loadingStore.set(false);
    }
  }

  function close(): void {
    openStore.set(false);
    filePathStore.set("");
    fileNameStore.set("");
    contentStore.set("");
    errorStore.set(undefined);
    isMarkdownStore.set(false);
    loadingStore.set(false);
  }

  return {
    open: { subscribe: openStore.subscribe },
    filePath: { subscribe: filePathStore.subscribe },
    fileName: { subscribe: fileNameStore.subscribe },
    content: { subscribe: contentStore.subscribe },
    error: { subscribe: errorStore.subscribe },
    isMarkdown: { subscribe: isMarkdownStore.subscribe },
    loading: { subscribe: loadingStore.subscribe },
    openFile,
    close,
  };
}
