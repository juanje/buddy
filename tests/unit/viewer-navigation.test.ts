// tests/unit/viewer-navigation.test.ts — FR-CHAT-12.
//
// Links inside a document are written relative to that document, not to the
// buddy root. The cases below are taken verbatim from a real wiki page at
// user/wiki/aprendizaje-y-habilidad/consolidacion-memoria.md — resolving them
// against the root would have rejected every one.
//
// Containment is unchanged: `..` is collapsed after joining, so a link that
// walks past the root is still refused rather than clamped.

import { describe, expect, it, vi } from "vitest";

import { createFileViewerController } from "../../src/lib/file-viewer-controller";
import { resolveViewablePath } from "../../shared/viewable-path";

const ROOT = "/home/buddy";
const PAGE = "user/wiki/aprendizaje-y-habilidad/consolidacion-memoria.md";

function readStore<T>(store: { subscribe: (fn: (value: T) => void) => () => void }): T {
  let value!: T;
  store.subscribe((next) => {
    value = next;
  })();
  return value;
}

function controllerAt(contents: Record<string, string>) {
  const readViewableFile = vi.fn(async (relPath: string) => {
    const found = contents[relPath];
    if (found === undefined) throw new Error(`File not found: ${relPath}`);
    return found;
  });
  const controller = createFileViewerController({
    readViewableFile,
    rootDir: () => ROOT,
  });
  return { controller, readViewableFile };
}

describe("resolveViewablePath with a document base", () => {
  it.each([
    ["ley-de-hebb.md", "user/wiki/aprendizaje-y-habilidad/ley-de-hebb.md"],
    ["repaso-espaciado.md", "user/wiki/aprendizaje-y-habilidad/repaso-espaciado.md"],
    [
      "../sistema-nervioso-y-cerebro/neurogenesis-bdnf.md",
      "user/wiki/sistema-nervioso-y-cerebro/neurogenesis-bdnf.md",
    ],
    [
      "../agentes-de-ia-y-memoria/cuatro-zonas-de-memoria-agente.md",
      "user/wiki/agentes-de-ia-y-memoria/cuatro-zonas-de-memoria-agente.md",
    ],
    ["./aprendizaje.md", "user/wiki/aprendizaje-y-habilidad/aprendizaje.md"],
    ["../../notas/idea.md", "user/notas/idea.md"],
  ])("resolves %s against the document's directory", (href, expected) => {
    expect(resolveViewablePath(ROOT, href, PAGE)).toBe(expected);
  });

  it("still resolves against the root when no base is given", () => {
    expect(resolveViewablePath(ROOT, "ley-de-hebb.md")).toBeNull();
    expect(resolveViewablePath(ROOT, "user/wiki/x.md")).toBe("user/wiki/x.md");
  });

  it.each([
    "../../../../secret.md",
    "../../../etc/passwd",
    "../../../../../../../../tmp/x.md",
  ])("refuses %s, which walks past the root", (href) => {
    expect(resolveViewablePath(ROOT, href, PAGE)).toBeNull();
  });

  it("refuses a link that leaves the four user-facing directories", () => {
    // ../../../ from user/wiki/topic/ lands at the root itself.
    expect(resolveViewablePath(ROOT, "../../../AGENTS.md", PAGE)).toBeNull();
    expect(resolveViewablePath(ROOT, "../../../.buddy/state.json", PAGE)).toBeNull();
  });

  it("refuses a non-viewable type even next to the document", () => {
    expect(resolveViewablePath(ROOT, "diagram.png", PAGE)).toBeNull();
    expect(resolveViewablePath(ROOT, "notes.pdf", PAGE)).toBeNull();
  });
});

describe("followLink", () => {
  it("navigates to a sibling page", async () => {
    const { controller } = controllerAt({
      [PAGE]: "# Consolidación",
      "user/wiki/aprendizaje-y-habilidad/ley-de-hebb.md": "# Ley de Hebb",
    });

    await controller.openFile(PAGE);
    expect(await controller.followLink("ley-de-hebb.md")).toBe(true);

    expect(readStore(controller.filePath)).toBe(
      "user/wiki/aprendizaje-y-habilidad/ley-de-hebb.md",
    );
    expect(readStore(controller.content)).toBe("# Ley de Hebb");
    expect(readStore(controller.fileName)).toBe("ley-de-hebb.md");
  });

  it("navigates across sibling directories", async () => {
    const target = "user/wiki/sistema-nervioso-y-cerebro/neurogenesis-bdnf.md";
    const { controller } = controllerAt({ [PAGE]: "# A", [target]: "# BDNF" });

    await controller.openFile(PAGE);
    await controller.followLink("../sistema-nervioso-y-cerebro/neurogenesis-bdnf.md");

    expect(readStore(controller.filePath)).toBe(target);
  });

  it("refuses to follow a link out of bounds and stays put", async () => {
    const { controller, readViewableFile } = controllerAt({ [PAGE]: "# A" });

    await controller.openFile(PAGE);
    readViewableFile.mockClear();

    expect(await controller.followLink("../../../../secret.md")).toBe(false);
    expect(readViewableFile).not.toHaveBeenCalled();
    expect(readStore(controller.filePath)).toBe(PAGE);
  });

  it("does nothing when no document is open", async () => {
    const { controller } = controllerAt({});
    expect(await controller.followLink("anything.md")).toBe(false);
  });
});

describe("back navigation", () => {
  const HEBB = "user/wiki/aprendizaje-y-habilidad/ley-de-hebb.md";
  const BDNF = "user/wiki/sistema-nervioso-y-cerebro/neurogenesis-bdnf.md";

  function threePages() {
    return controllerAt({ [PAGE]: "# A", [HEBB]: "# B", [BDNF]: "# C" });
  }

  it("is unavailable until a link has been followed", async () => {
    const { controller } = threePages();
    await controller.openFile(PAGE);
    expect(readStore(controller.canGoBack)).toBe(false);
  });

  it("returns through the trail one step at a time", async () => {
    const { controller } = threePages();
    await controller.openFile(PAGE);
    await controller.followLink("ley-de-hebb.md");
    await controller.followLink("../sistema-nervioso-y-cerebro/neurogenesis-bdnf.md");

    expect(readStore(controller.filePath)).toBe(BDNF);
    expect(readStore(controller.canGoBack)).toBe(true);

    await controller.back();
    expect(readStore(controller.filePath)).toBe(HEBB);
    expect(readStore(controller.content)).toBe("# B");

    await controller.back();
    expect(readStore(controller.filePath)).toBe(PAGE);
    expect(readStore(controller.canGoBack)).toBe(false);
  });

  it("starts a fresh trail when opened from the chat again", async () => {
    const { controller } = threePages();
    await controller.openFile(PAGE);
    await controller.followLink("ley-de-hebb.md");
    expect(readStore(controller.canGoBack)).toBe(true);

    await controller.openFile(BDNF);
    expect(readStore(controller.canGoBack)).toBe(false);
  });

  it("clears the trail on close", async () => {
    const { controller } = threePages();
    await controller.openFile(PAGE);
    await controller.followLink("ley-de-hebb.md");
    controller.close();

    expect(readStore(controller.canGoBack)).toBe(false);
  });
});
