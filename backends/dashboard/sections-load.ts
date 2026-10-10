// backends/dashboard/sections-load.ts — Load sections source rows (FR-DASH-06).

import { ViewableFileError, readViewableFile } from "../viewable-file";
import type { SourceDefinition } from "../../shared/dashboard/source-fields";
import {
  inferSectionsSourceDefinition,
  parseSections,
  sectionsFit,
} from "../../shared/dashboard/sections";
export type SectionsLoadResult =
  | { ok: true; rows: Record<string, unknown>[]; def: SourceDefinition }
  | { ok: false; message: string };

export function loadSectionsSource(rootDir: string, rawPath: string): SectionsLoadResult {
  let content: string;
  try {
    content = readViewableFile(rootDir, rawPath);
  } catch (err) {
    const message =
      err instanceof ViewableFileError
        ? err.message
        : "This file cannot be opened inside Buddy.";
    return { ok: false, message };
  }

  if (!sectionsFit(content)) {
    return {
      ok: false,
      message:
        "File does not fit the sections primitive (need at least one ## heading with a list item underneath)",
    };
  }

  const rows = parseSections(content);
  return { ok: true, rows, def: inferSectionsSourceDefinition(rows) };
}
