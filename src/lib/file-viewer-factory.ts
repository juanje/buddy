// src/lib/file-viewer-factory.ts — Default FR-CHAT-10 controller wiring.

import { readTextFile } from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";

import { createFileViewerController, type FileViewerController } from "./file-viewer-controller";

export function createDefaultFileViewerController(): FileViewerController {
  return createFileViewerController({
    readTextFile: (path) => readTextFile(path),
    openPath: (path) => openPath(path),
  });
}
