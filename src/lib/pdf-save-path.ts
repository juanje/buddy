// src/lib/pdf-save-path.ts — Where the PDF save dialog opens.
//
// A bare filename makes the GTK dialog start in the process working directory.
// `tauri dev` runs from src-tauri, which is not a folder the user has.

import { dirname } from "../utils/path";

/** Absolute path the dialog should open on: directory plus suggested file name. */
export function pdfDialogDefaultPath(directory: string, fileName: string): string {
  const dir = directory.replace(/[/\\]+$/, "");
  const sep = dir.includes("\\") && !dir.includes("/") ? "\\" : "/";
  return `${dir}${sep}${fileName}`;
}

/** First directory that resolves, or undefined when none does. */
async function firstResolvedDirectory(
  candidates: Array<() => Promise<string>>,
): Promise<string | undefined> {
  for (const candidate of candidates) {
    try {
      return await candidate();
    } catch {
      // Not configured on this system (e.g. no XDG downloads dir); try the next.
    }
  }
  return undefined;
}

/**
 * Where the next save dialog opens. The downloads directory is whatever the
 * OS resolved (XDG on Linux); this object does not rename it. When the OS has
 * none, the home directory is used, and failing that the bare file name — the
 * dialog must still open. A confirmed save replaces that starting directory.
 * A cancel does not.
 */
export function createPdfSaveLocation(
  downloadsDirectory: () => Promise<string>,
  homeDirectory?: () => Promise<string>,
) {
  let lastDirectory: string | undefined;
  const candidates = homeDirectory ? [downloadsDirectory, homeDirectory] : [downloadsDirectory];
  return {
    async suggestedPath(fileName: string): Promise<string> {
      const directory = lastDirectory ?? (await firstResolvedDirectory(candidates));
      return directory ? pdfDialogDefaultPath(directory, fileName) : fileName;
    },
    confirm(savedPath: string): void {
      lastDirectory = dirname(savedPath);
    },
  };
}

/** Dialog plus write. Cancel returns before confirm and before any write. */
export function createPdfSaver(deps: {
  downloadsDirectory: () => Promise<string>;
  homeDirectory?: () => Promise<string>;
  openDialog: (defaultPath: string) => Promise<string | null>;
  writeFile: (path: string, data: Uint8Array) => Promise<void>;
}) {
  const location = createPdfSaveLocation(deps.downloadsDirectory, deps.homeDirectory);
  return {
    async save(fileName: string, data: Uint8Array): Promise<void> {
      const defaultPath = await location.suggestedPath(fileName);
      const chosen = await deps.openDialog(defaultPath);
      if (!chosen) return;
      location.confirm(chosen);
      await deps.writeFile(chosen, data);
    },
  };
}
