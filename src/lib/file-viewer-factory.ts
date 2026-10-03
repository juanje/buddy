// src/lib/file-viewer-factory.ts — Default FR-CHAT-10/11/18/20 controller wiring.
//
// File content arrives over worker RPC. The frontend has no `fs` capability
// (NFR-SEC-09). Reveal and PDF export are user clicks, not agent actions.

import { invoke } from "@tauri-apps/api/core";
import { downloadDir, homeDir } from "@tauri-apps/api/path";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

import type { WorkerAPI } from "../../shared/api";
import { createFileViewerController, type FileViewerController } from "./file-viewer-controller";
import { createPdfSaver } from "./pdf-save-path";
import { platformSupportsPdf } from "./platform-support-pdf";

const pdfSaver = createPdfSaver({
  downloadsDirectory: downloadDir,
  homeDirectory: homeDir,
  openDialog: (defaultPath) =>
    save({
      defaultPath,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    }),
  writeFile: (path, data) => writeFile(path, data),
});

export function createDefaultFileViewerController(
  worker: Pick<WorkerAPI, "readViewableFile">,
  rootDir: () => string,
): FileViewerController {
  return createFileViewerController({
    readViewableFile: (relPath) => worker.readViewableFile(relPath),
    // Needed to resolve links written inside a document (FR-CHAT-12).
    rootDir,
    revealInFileManager: (absPath) => revealItemInDir(absPath),
    platformSupportsPdf:
      typeof navigator !== "undefined" && platformSupportsPdf(navigator.userAgent),
    createPdf: async (html) => {
      const bytes = await invoke<number[]>("create_pdf", { html });
      return Uint8Array.from(bytes);
    },
    savePdf: (suggestedName, data) => pdfSaver.save(suggestedName, data),
  });
}
