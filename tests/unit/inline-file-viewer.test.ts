// tests/unit/inline-file-viewer.test.ts — FR-CHAT-10 inline file viewer.

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
    expect(isViewableFile("notes/readme.txt")).toBe(true);
    expect(isViewableFile("agent_brain/foo.MD")).toBe(true);
    expect(isViewableFile("notes/readme.TXT")).toBe(true);
  });

  it("rejects other extensions", () => {
    expect(isViewableFile("docs/guide.pdf")).toBe(false);
    expect(isViewableFile("image.png")).toBe(false);
    expect(isViewableFile("agent_brain/noext")).toBe(false);
  });
});

describe("routeLocalLinkClick", () => {
  it("routes markdown links to the inline viewer", () => {
    expect(routeLocalLinkClick("/home/buddy", "agent_brain/foo.md")).toEqual({
      type: "view",
      absPath: "/home/buddy/agent_brain/foo.md",
    });
  });

  it("routes text links to the inline viewer", () => {
    expect(routeLocalLinkClick("/home/buddy", "notes/readme.txt")).toEqual({
      type: "view",
      absPath: "/home/buddy/notes/readme.txt",
    });
  });

  it("falls back to system open for unsupported types", () => {
    expect(routeLocalLinkClick("/home/buddy", "docs/guide.pdf")).toEqual({
      type: "open",
      absPath: "/home/buddy/docs/guide.pdf",
    });
  });

  it("returns null for paths outside rootDir", () => {
    expect(routeLocalLinkClick("/home/buddy", "/etc/passwd")).toBeNull();
  });
});

describe("FileViewerController", () => {
  it("loads markdown content and metadata", async () => {
    const readTextFile = vi.fn(async () => "# Title\n\nBody");
    const openPath = vi.fn(async () => {});
    const controller = createFileViewerController({ readTextFile, openPath });

    await controller.openFile("/home/buddy/agent_brain/foo.md");

    expect(readStore(controller.open)).toBe(true);
    expect(readStore(controller.filePath)).toBe("/home/buddy/agent_brain/foo.md");
    expect(readStore(controller.fileName)).toBe("foo.md");
    expect(readStore(controller.isMarkdown)).toBe(true);
    expect(readStore(controller.content)).toBe("# Title\n\nBody");
    expect(readStore(controller.error)).toBeUndefined();
    expect(readStore(controller.loading)).toBe(false);
  });

  it("loads plain text content", async () => {
    const readTextFile = vi.fn(async () => "Plain notes");
    const openPath = vi.fn(async () => {});
    const controller = createFileViewerController({ readTextFile, openPath });

    await controller.openFile("/home/buddy/notes/readme.txt");

    expect(readStore(controller.isMarkdown)).toBe(false);
    expect(readStore(controller.content)).toBe("Plain notes");
  });

  it("closes and clears state", async () => {
    const readTextFile = vi.fn(async () => "# Title");
    const openPath = vi.fn(async () => {});
    const controller = createFileViewerController({ readTextFile, openPath });

    await controller.openFile("/home/buddy/agent_brain/foo.md");
    controller.close();

    expect(readStore(controller.open)).toBe(false);
    expect(readStore(controller.filePath)).toBe("");
    expect(readStore(controller.content)).toBe("");
  });

  it("opens externally via system opener", async () => {
    const readTextFile = vi.fn(async () => "# Title");
    const openPath = vi.fn(async () => {});
    const controller = createFileViewerController({ readTextFile, openPath });

    await controller.openFile("/home/buddy/agent_brain/foo.md");
    await controller.openExternally();

    expect(openPath).toHaveBeenCalledWith("/home/buddy/agent_brain/foo.md");
  });

  it("surfaces read errors without closing", async () => {
    const readTextFile = vi.fn(async () => {
      throw new Error("ENOENT: missing file");
    });
    const openPath = vi.fn(async () => {});
    const controller = createFileViewerController({ readTextFile, openPath });

    await controller.openFile("/home/buddy/missing.md");

    expect(readStore(controller.open)).toBe(true);
    expect(readStore(controller.error)).toMatch(/ENOENT/);
    expect(readStore(controller.content)).toBe("");
  });
});
