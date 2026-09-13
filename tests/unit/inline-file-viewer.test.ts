// tests/unit/inline-file-viewer.test.ts — FR-CHAT-10/11 inline file viewer.

import { describe, expect, it, vi } from "vitest";

import { createFileViewerController } from "../../src/lib/file-viewer-controller";
import { routeLocalLinkClick } from "../../src/lib/local-link-handler";
import { isViewableFile } from "../../src/lib/local-path";

function readStore<T>(store: { subscribe: (fn: (value: T) => void) => () => void }): T {
  let value!: T;
  store.subscribe((next) => {
    value = next;
  })();
  return value;
}

describe("isViewableFile", () => {
  it("accepts markdown and text extensions", () => {
    expect(isViewableFile("agent_brain/foo.md")).toBe(true);
    expect(isViewableFile("user/readme.txt")).toBe(true);
    expect(isViewableFile("agent_brain/foo.MD")).toBe(true);
    expect(isViewableFile("user/readme.TXT")).toBe(true);
  });

  it("rejects other extensions", () => {
    expect(isViewableFile("downloads/guide.pdf")).toBe(false);
    expect(isViewableFile("image.png")).toBe(false);
    expect(isViewableFile("agent_brain/noext")).toBe(false);
  });
});

describe("routeLocalLinkClick", () => {
  it("routes markdown links to the inline viewer", () => {
    expect(routeLocalLinkClick("/home/buddy", "agent_brain/foo.md")).toEqual({
      type: "view",
      relPath: "agent_brain/foo.md",
    });
  });

  it("routes text links to the inline viewer", () => {
    expect(routeLocalLinkClick("/home/buddy", "user/notes/readme.txt")).toEqual({
      type: "view",
      relPath: "user/notes/readme.txt",
    });
  });

  it("refuses unsupported types instead of delegating to the system", () => {
    expect(routeLocalLinkClick("/home/buddy", "downloads/guide.pdf")).toBeNull();
    expect(routeLocalLinkClick("/home/buddy", "downloads/payload.command")).toBeNull();
  });

  it("returns null for paths outside rootDir", () => {
    expect(routeLocalLinkClick("/home/buddy", "/etc/passwd")).toBeNull();
    expect(routeLocalLinkClick("/home/buddy", "../../secret.md")).toBeNull();
  });
});

describe("FileViewerController", () => {
  it("loads markdown content and metadata", async () => {
    const readViewableFile = vi.fn(async () => "# Title\n\nBody");
    const controller = createFileViewerController({ readViewableFile });

    await controller.openFile("agent_brain/foo.md");

    expect(readStore(controller.open)).toBe(true);
    expect(readStore(controller.filePath)).toBe("agent_brain/foo.md");
    expect(readStore(controller.fileName)).toBe("foo.md");
    expect(readStore(controller.isMarkdown)).toBe(true);
    expect(readStore(controller.content)).toBe("# Title\n\nBody");
    expect(readStore(controller.error)).toBeUndefined();
    expect(readStore(controller.loading)).toBe(false);
  });

  it("loads plain text content", async () => {
    const readViewableFile = vi.fn(async () => "Plain notes");
    const controller = createFileViewerController({ readViewableFile });

    await controller.openFile("user/notes/readme.txt");

    expect(readStore(controller.isMarkdown)).toBe(false);
    expect(readStore(controller.content)).toBe("Plain notes");
  });

  it("closes and clears state", async () => {
    const readViewableFile = vi.fn(async () => "# Title");
    const controller = createFileViewerController({ readViewableFile });

    await controller.openFile("agent_brain/foo.md");
    controller.close();

    expect(readStore(controller.open)).toBe(false);
    expect(readStore(controller.filePath)).toBe("");
    expect(readStore(controller.content)).toBe("");
  });

  it("exposes no external-open action (FR-CHAT-11)", () => {
    const readViewableFile = vi.fn(async () => "# Title");
    const controller = createFileViewerController({ readViewableFile });

    expect("openExternally" in controller).toBe(false);
  });

  it("surfaces read errors without closing", async () => {
    const readViewableFile = vi.fn(async () => {
      throw new Error("File not found: agent_brain/missing.md");
    });
    const controller = createFileViewerController({ readViewableFile });

    await controller.openFile("agent_brain/missing.md");

    expect(readStore(controller.open)).toBe(true);
    expect(readStore(controller.error)).toMatch(/not found/);
    expect(readStore(controller.content)).toBe("");
  });
});

describe("FileViewerController reveal (FR-CHAT-20)", () => {
  const ROOT = "/home/test/buddy";

  it("offers reveal for user/ files and not for agent_brain/", async () => {
    const readViewableFile = vi.fn(async () => "# Title");
    const controller = createFileViewerController({
      readViewableFile,
      rootDir: () => ROOT,
    });

    await controller.openFile("user/tasks.md");
    expect(readStore(controller.canReveal)).toBe(true);

    await controller.openFile("agent_brain/observations.md");
    expect(readStore(controller.canReveal)).toBe(false);
  });

  it("reveals the absolute path via the injected opener", async () => {
    const readViewableFile = vi.fn(async () => "# Tasks");
    const revealInFileManager = vi.fn(async () => undefined);
    const controller = createFileViewerController({
      readViewableFile,
      rootDir: () => ROOT,
      revealInFileManager,
    });

    await controller.openFile("user/tasks.md");
    await controller.reveal();

    expect(revealInFileManager).toHaveBeenCalledWith("/home/test/buddy/user/tasks.md");
  });

  it("does not call the opener for a traversal path", async () => {
    const readViewableFile = vi.fn(async () => "x");
    const revealInFileManager = vi.fn(async () => undefined);
    const controller = createFileViewerController({
      readViewableFile,
      rootDir: () => ROOT,
      revealInFileManager,
    });

    await controller.openFile("user/../../../etc/passwd");
    expect(readStore(controller.canReveal)).toBe(false);
    await controller.reveal();
    expect(revealInFileManager).not.toHaveBeenCalled();
  });
});

describe("FileViewerController export PDF (FR-CHAT-18)", () => {
  it("offers export for markdown when the platform supports it", async () => {
    const readViewableFile = vi.fn(async () => "# Title");
    const controller = createFileViewerController({
      readViewableFile,
      platformSupportsPdf: true,
    });

    await controller.openFile("agent_brain/concepts/foo.md");
    expect(readStore(controller.canExportPdf)).toBe(true);

    await controller.openFile("user/notes.txt");
    expect(readStore(controller.canExportPdf)).toBe(false);
  });

  it("hides export when the platform does not support PDF", async () => {
    const readViewableFile = vi.fn(async () => "# Title");
    const controller = createFileViewerController({
      readViewableFile,
      platformSupportsPdf: false,
    });

    await controller.openFile("user/notes.md");
    expect(readStore(controller.canExportPdf)).toBe(false);
  });

  it("calls createPdf and savePdf with a .pdf filename", async () => {
    const readViewableFile = vi.fn(async () => "# Hello");
    const createPdf = vi.fn(async () => new Uint8Array([1, 2, 3]));
    const savePdf = vi.fn(async () => undefined);
    const controller = createFileViewerController({
      readViewableFile,
      platformSupportsPdf: true,
      createPdf,
      savePdf,
    });

    await controller.openFile("user/notes.md");
    await controller.exportPdf();

    expect(createPdf).toHaveBeenCalledOnce();
    expect(savePdf).toHaveBeenCalledWith("notes.pdf", expect.any(Uint8Array));
  });
});
