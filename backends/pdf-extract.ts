// backends/pdf-extract.ts — FR-INGEST-06 local PDF text extraction.

import { readFileSync } from "node:fs";
import { PDFParse } from "pdf-parse";

export async function extractPdfText(filePath: string): Promise<string> {
  try {
    const buffer = readFileSync(filePath);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return result.text?.trim() ?? "";
  } catch {
    return "";
  }
}
