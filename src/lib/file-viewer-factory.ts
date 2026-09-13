// src/lib/file-viewer-factory.ts — Default FR-CHAT-10/11/18/20 controller wiring.
//
// File content arrives over worker RPC. The frontend has no `fs` capability
// (NFR-SEC-09). Reveal and PDF export are user clicks, not agent actions.

import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

import type { WorkerAPI } from "../../shared/api";
import { createFileViewerController, type FileViewerController } from "./file-viewer-controller";

function platformSupportsPdf(): boolean {
  return typeof navigator !== "undefined" && /Mac|macOS|Macintosh/i.test(navigator.userAgent);
}

export function createDefaultFileViewerController(
  worker: Pick<WorkerAPI, "readViewableFile">,
  rootDir: () => string,
): FileViewerController {
  return createFileViewerController({
    readViewableFile: (relPath) => worker.readViewableFile(relPath),
    // Needed to resolve links written inside a document (FR-CHAT-12).
    rootDir,
    revealInFileManager: (absPath) => revealItemInDir(absPath),
    platformSupportsPdf: platformSupportsPdf(),
    createPdf: async (html) => {
      const bytes = await invoke<number[]>("create_pdf", { html });
      return Uint8Array.from(bytes);
    },
    savePdf: async (suggestedName, data) => {
      const path = await save({
        defaultPath: suggestedName,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!path) return;
      await writeFile(path, data);
    },
  });
}
