// backends/dashboard/series-load.ts — Load series (CSV) source rows (FR-DASH-08).

import { parse, CsvError } from "csv-parse/sync";

import type { SourceDefinition } from "../../shared/dashboard/source-fields";
import {
  SeriesHeaderError,
  castSeriesRows,
  inferSeriesDefinition,
  validateSeriesHeader,
} from "../../shared/dashboard/series";
import { ViewableFileError, readViewableFile } from "../viewable-file";

export type SeriesLoadResult =
  | { ok: true; rows: Record<string, unknown>[]; def: SourceDefinition; header: string[] }
  | { ok: false; message: string };

function parseSeriesRecords(text: string): SeriesLoadResult {
  let header: string[] = [];
  try {
    const records = parse(text, {
      columns: (cols: string[]) => {
        const err = validateSeriesHeader(cols);
        if (err) throw new SeriesHeaderError(err);
        header = cols.map((c) => c.trim());
        return header;
      },
      bom: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: false,
    }) as Record<string, string>[];
    if (header.length === 0) {
      return { ok: false, message: "CSV header is empty" };
    }
    const def = inferSeriesDefinition(header, records);
    const rows = castSeriesRows(records, def);
    return { ok: true, rows, def, header };
  } catch (err) {
    if (err instanceof SeriesHeaderError) {
      return { ok: false, message: err.message };
    }
    if (err instanceof CsvError) {
      const recordLen = Array.isArray(err.record) ? err.record.length : undefined;
      const line = err.lines ?? recordLen ?? "?";
      return { ok: false, message: `CSV parse error at line ${line}: ${err.message}` };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
}

export function loadSeriesSource(rootDir: string, rawPath: string): SeriesLoadResult {
  if (!/\.csv$/i.test(rawPath.trim())) {
    return { ok: false, message: "series source requires a .csv path" };
  }
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
  return parseSeriesRecords(content);
}
