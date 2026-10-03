import { describe, expect, it } from "vitest";

import {
  createPdfSaver,
  createPdfSaveLocation,
  pdfDialogDefaultPath,
} from "../../src/lib/pdf-save-path";

describe("PDF save dialog path", () => {
  it("opens in a user directory instead of a bare filename", () => {
    expect(pdfDialogDefaultPath("/home/ana/Descargas", "notas.pdf")).toBe(
      "/home/ana/Descargas/notas.pdf",
    );
  });

  it("drops a trailing slash before joining the file name", () => {
    expect(pdfDialogDefaultPath("/home/ana/Descargas/", "notas.pdf")).toBe(
      "/home/ana/Descargas/notas.pdf",
    );
  });
});

describe("PDF save location (FR-CHAT-18)", () => {
  it("uses the downloads path the operating system returned, without renaming it", async () => {
    const location = createPdfSaveLocation(async () => "/home/ana/Descargas");
    await expect(location.suggestedPath("notas.pdf")).resolves.toBe(
      "/home/ana/Descargas/notas.pdf",
    );

    const english = createPdfSaveLocation(async () => "/home/ana/Downloads");
    await expect(english.suggestedPath("notes.pdf")).resolves.toBe("/home/ana/Downloads/notes.pdf");
  });

  it("falls back to the home directory when the OS has no downloads directory", async () => {
    const location = createPdfSaveLocation(
      async () => {
        throw new Error("unknown path");
      },
      async () => "/home/ana",
    );
    await expect(location.suggestedPath("notas.pdf")).resolves.toBe("/home/ana/notas.pdf");
  });

  it("still offers the file name when no directory can be resolved", async () => {
    const fail = async (): Promise<string> => {
      throw new Error("unknown path");
    };
    const location = createPdfSaveLocation(fail, fail);
    await expect(location.suggestedPath("notas.pdf")).resolves.toBe("notas.pdf");
  });

  it("opens the next export in the directory the user confirmed", async () => {
    const location = createPdfSaveLocation(async () => "/home/ana/Descargas");
    location.confirm("/home/ana/Documentos/notas.pdf");
    await expect(location.suggestedPath("otra.pdf")).resolves.toBe(
      "/home/ana/Documentos/otra.pdf",
    );
  });

  it("does not change the starting directory when the dialog is cancelled", async () => {
    const offered: string[] = [];
    const written: string[] = [];
    const saver = createPdfSaver({
      downloadsDirectory: async () => "/home/ana/Descargas",
      openDialog: async (defaultPath) => {
        offered.push(defaultPath);
        return null;
      },
      writeFile: async (path) => {
        written.push(path);
      },
    });

    await saver.save("notas.pdf", new Uint8Array([1]));
    await saver.save("otra.pdf", new Uint8Array([1]));

    expect(offered).toEqual([
      "/home/ana/Descargas/notas.pdf",
      "/home/ana/Descargas/otra.pdf",
    ]);
    expect(written).toEqual([]);
  });

  it("writes only the path the user confirmed and offers that directory next", async () => {
    const offered: string[] = [];
    const written: string[] = [];
    let choice: string | null = "/home/ana/Documentos/notas.pdf";
    const saver = createPdfSaver({
      downloadsDirectory: async () => "/home/ana/Descargas",
      openDialog: async (defaultPath) => {
        offered.push(defaultPath);
        const chosen = choice;
        choice = "/home/ana/Documentos/otra.pdf";
        return chosen;
      },
      writeFile: async (path) => {
        written.push(path);
      },
    });

    await saver.save("notas.pdf", new Uint8Array([1]));
    await saver.save("otra.pdf", new Uint8Array([1]));

    expect(offered).toEqual([
      "/home/ana/Descargas/notas.pdf",
      "/home/ana/Documentos/otra.pdf",
    ]);
    expect(written).toEqual([
      "/home/ana/Documentos/notas.pdf",
      "/home/ana/Documentos/otra.pdf",
    ]);
  });
});
