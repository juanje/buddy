// backends/pdf-extract.ts — FR-INGEST-06 local PDF text extraction.
//
// pdfjs-dist requires a worker file (`pdf.worker.mjs`) accessible on the real
// filesystem. In dev (Node.js/tsx) this resolves from node_modules via pdfjs's
// internal require(). In a bun-compiled binary the virtual FS (`/$bunfs/`) has
// no loose files, so we write the embedded worker to a temp path on first use.
// The worker source is embedded via generate-embedded-assets.ts at build time.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PDFParse } from "pdf-parse";
import { GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import { getEmbeddedAssets } from "./embedded-assets";

let workerReady = false;

function ensureWorker(): void {
  if (workerReady) return;
  const assets = getEmbeddedAssets();
  if (assets?.pdfWorker) {
    const workerPath = join(tmpdir(), "buddy-pdf-worker.mjs");
    if (!existsSync(workerPath)) {
      writeFileSync(workerPath, assets.pdfWorker);
    }
    GlobalWorkerOptions.workerSrc = workerPath;
  }
  workerReady = true;
}

export async function extractPdfText(filePath: string): Promise<string> {
  try {
    ensureWorker();
    const buffer = readFileSync(filePath);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return result.text?.trim() ?? "";
  } catch {
    return "";
  }
}
