// src/lib/file-viewer-factory.ts — Default FR-CHAT-10/11 controller wiring.
//
// File content arrives over worker RPC. The frontend has no `fs` capability and
// no system opener (NFR-SEC-09).

import type { WorkerAPI } from "../../shared/api";
import { createFileViewerController, type FileViewerController } from "./file-viewer-controller";

export function createDefaultFileViewerController(
  worker: Pick<WorkerAPI, "readViewableFile">,
): FileViewerController {
  return createFileViewerController({
    readViewableFile: (relPath) => worker.readViewableFile(relPath),
  });
}
