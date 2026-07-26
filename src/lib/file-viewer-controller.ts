// src/lib/file-viewer-controller.ts — Inline file viewer state (FR-CHAT-10).

import { get, writable, type Readable } from "svelte/store";

import { basename } from "../utils/path";
import { isViewableFile } from "./local-path";

export interface FileViewerDeps {
  readTextFile(path: string): Promise<string>;
  openPath(path: string): Promise<void>;
}

export interface FileViewerController {
  open: Readable<boolean>;
  filePath: Readable<string>;
  fileName: Readable<string>;
  content: Readable<string>;
  error: Readable<string | undefined>;
  isMarkdown: Readable<boolean>;
  loading: Readable<boolean>;
  openFile(absPath: string): Promise<void>;
  close(): void;
  openExternally(): Promise<void>;
}

export function createFileViewerController(deps: FileViewerDeps): FileViewerController {
  const openStore = writable(false);
  const filePathStore = writable("");
  const fileNameStore = writable("");
  const contentStore = writable("");
  const errorStore = writable<string | undefined>(undefined);
  const isMarkdownStore = writable(false);
  const loadingStore = writable(false);

  async function openFile(absPath: string): Promise<void> {
    openStore.set(true);
    filePathStore.set(absPath);
    fileNameStore.set(basename(absPath));
    isMarkdownStore.set(/\.md$/i.test(absPath));
    contentStore.set("");
    errorStore.set(undefined);
    loadingStore.set(true);

    try {
      const text = await deps.readTextFile(absPath);
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

  async function openExternally(): Promise<void> {
    const path = get(filePathStore);
    if (!path || !isViewableFile(path)) return;
    await deps.openPath(path);
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
    openExternally,
  };
}
