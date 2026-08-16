// tests/unit/file-tools.test.ts — FR-DELETE-01/02, FR-FILE-01/02/03.

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { simpleGit } from "simple-git";

import {
  buildFileTools,
  copyWorkspaceFile,
  deleteWorkspaceFile,
  executeFileTool,
  FileToolError,
  isFileOpProtected,
  moveWorkspaceFile,
  validateCopyDestination,
  validateDeletablePath,
  validateMoveDestination,
  validateMoveSource,
} from "../../backends/file-tools";
import { initTestGitRepo } from "../support/test-git";

describe("isFileOpProtected", () => {
  it("protects structural hub files", () => {
    expect(isFileOpProtected("agent_brain/observations.md")).toBe(true);
    expect(isFileOpProtected("agent_brain/concepts/index.md")).toBe(true);
    expect(isFileOpProtected("user/inbox.md")).toBe(true);
    expect(isFileOpProtected("AGENTS.md")).toBe(true);
  });

  it("allows non-protected brain files", () => {
    expect(isFileOpProtected("agent_brain/concepts/foo.md")).toBe(false);
    expect(isFileOpProtected("agent_brain/projects/buddy/bugs.md")).toBe(false);
    expect(isFileOpProtected("agent_brain/identity/family.md")).toBe(false);
  });

  it("blocks all logs paths", () => {
    expect(isFileOpProtected("logs/2026-08-01.md")).toBe(true);
    expect(isFileOpProtected("logs/archive/2026-07/2026-07-08.md")).toBe(true);
  });
});

describe("validateDeletablePath", () => {
  const rootDir = "/buddy";

  it("allows user/ paths that are not protected", () => {
    expect(validateDeletablePath(rootDir, "user/notes.md")).toEqual({
      absPath: join(rootDir, "user/notes.md"),
      relPath: "user/notes.md",
    });
  });

  it("rejects protected inbox", () => {
    expect(() => validateDeletablePath(rootDir, "user/inbox.md")).toThrow(/not allowed/);
  });

  it("allows non-protected agent_brain paths", () => {
    expect(validateDeletablePath(rootDir, "agent_brain/concepts/foo.md")).toEqual({
      absPath: join(rootDir, "agent_brain/concepts/foo.md"),
      relPath: "agent_brain/concepts/foo.md",
    });
  });

  it("rejects protected agent_brain paths", () => {
    expect(() => validateDeletablePath(rootDir, "agent_brain/observations.md")).toThrow(
      /not allowed/,
    );
  });

  it("rejects identity root files", () => {
    expect(() => validateDeletablePath(rootDir, "AGENTS.md")).toThrow(/not allowed/);
  });

  it("rejects logs paths", () => {
    expect(() => validateDeletablePath(rootDir, "logs/2026-08-01.md")).toThrow(/not allowed/);
  });
});

describe("validateCopyDestination", () => {
  const rootDir = "/buddy";

  it("allows destination under user/", () => {
    expect(validateCopyDestination(rootDir, "user/copy.txt")).toEqual({
      absPath: join(rootDir, "user/copy.txt"),
      relPath: "user/copy.txt",
    });
  });

  it("rejects destination under agent_brain/", () => {
    expect(() => validateCopyDestination(rootDir, "agent_brain/x.md")).toThrow(/not allowed/);
  });
});

describe("validateMoveSource", () => {
  const rootDir = "/buddy";

  it("allows user/ source", () => {
    expect(validateMoveSource(rootDir, "user/a.md")).toEqual({
      absPath: join(rootDir, "user/a.md"),
      relPath: "user/a.md",
    });
  });

  it("allows non-protected agent_brain source", () => {
    expect(validateMoveSource(rootDir, "agent_brain/concepts/x.md")).toEqual({
      absPath: join(rootDir, "agent_brain/concepts/x.md"),
      relPath: "agent_brain/concepts/x.md",
    });
  });

  it("rejects protected agent_brain source", () => {
    expect(() => validateMoveSource(rootDir, "agent_brain/deferred.md")).toThrow(/not allowed/);
  });

  it("rejects logs source", () => {
    expect(() => validateMoveSource(rootDir, "logs/2026-08-01.md")).toThrow(/not allowed/);
  });
});

describe("validateMoveDestination", () => {
  const rootDir = "/buddy";

  it("allows destination under user/", () => {
    expect(validateMoveDestination(rootDir, "user/projects/a.md")).toEqual({
      absPath: join(rootDir, "user/projects/a.md"),
      relPath: "user/projects/a.md",
    });
  });

  it("allows destination under agent_brain/", () => {
    expect(validateMoveDestination(rootDir, "agent_brain/concepts/cluster/x.md")).toEqual({
      absPath: join(rootDir, "agent_brain/concepts/cluster/x.md"),
      relPath: "agent_brain/concepts/cluster/x.md",
    });
  });

  it("rejects protected destination", () => {
    expect(() => validateMoveDestination(rootDir, "agent_brain/observations.md")).toThrow(
      /not allowed/,
    );
  });

  it("rejects destination under logs/", () => {
    expect(() => validateMoveDestination(rootDir, "logs/archive/x.md")).toThrow(/not allowed/);
  });

  it("rejects destination outside rootDir", () => {
    expect(() => validateMoveDestination(rootDir, "/tmp/out.md")).toThrow(/not allowed/);
  });
});

describe("file tool execution", () => {
  let rootDir: string;
  let externalDir: string;

  afterEach(() => {
    if (rootDir) rmSync(rootDir, { recursive: true, force: true });
    if (externalDir) rmSync(externalDir, { recursive: true, force: true });
  });

  async function setupRepo(): Promise<void> {
    rootDir = mkdtempSync(join(tmpdir(), "buddy-filetools-"));
    mkdirSync(join(rootDir, "user"), { recursive: true });
    writeFileSync(join(rootDir, "AGENTS.md"), "# Rules\n");
    await initTestGitRepo(rootDir);
  }

  it("deleteWorkspaceFile removes tracked file via git rm", async () => {
    await setupRepo();
    writeFileSync(join(rootDir, "user/notes.md"), "task");
    await simpleGit(rootDir).add("user/notes.md").commit("seed");

    await deleteWorkspaceFile(rootDir, "user/notes.md", async () => true);
    expect(existsSync(join(rootDir, "user/notes.md"))).toBe(false);
  });

  it("allows deleting non-protected agent_brain/ files", async () => {
    await setupRepo();
    mkdirSync(join(rootDir, "agent_brain", "concepts"), { recursive: true });
    writeFileSync(join(rootDir, "agent_brain/concepts/old.md"), "old");
    await simpleGit(rootDir).add("agent_brain/concepts/old.md").commit("seed");

    await deleteWorkspaceFile(rootDir, "agent_brain/concepts/old.md", async () => true);
    expect(existsSync(join(rootDir, "agent_brain/concepts/old.md"))).toBe(false);
  });

  it("blocks deleting protected agent_brain/ files", async () => {
    await setupRepo();
    mkdirSync(join(rootDir, "agent_brain"), { recursive: true });
    writeFileSync(join(rootDir, "agent_brain/observations.md"), "## Active\n");

    await expect(
      deleteWorkspaceFile(rootDir, "agent_brain/observations.md", async () => true),
    ).rejects.toThrow(/not allowed/);
  });

  it("deleteWorkspaceFile returns declined when not confirmed", async () => {
    await setupRepo();
    writeFileSync(join(rootDir, "user/notes.md"), "task");

    const result = await deleteWorkspaceFile(rootDir, "user/notes.md", async () => false);
    expect(result).toContain("declined");
    expect(existsSync(join(rootDir, "user/notes.md"))).toBe(true);
  });

  it("copyWorkspaceFile copies external bytes without reading into LLM", async () => {
    await setupRepo();
    externalDir = mkdtempSync(join(tmpdir(), "buddy-filetools-ext-"));
    const externalPath = join(externalDir, "source.bin");
    writeFileSync(externalPath, Buffer.from([0, 1, 2, 3]));

    await copyWorkspaceFile(rootDir, externalPath, "user/source.bin", async () => true);
    const copied = readFileSync(join(rootDir, "user/source.bin"));
    expect([...copied]).toEqual([0, 1, 2, 3]);
  });

  it("copyWorkspaceFile skips permission prompt when source is in sessionAllowedPaths", async () => {
    await setupRepo();
    externalDir = mkdtempSync(join(tmpdir(), "buddy-filetools-ext-"));
    const externalPath = join(externalDir, "attached.md");
    writeFileSync(externalPath, "attached content");

    const sessionAllowedPaths = new Set([externalPath]);
    let permissionAsked = false;
    await copyWorkspaceFile(
      rootDir,
      externalPath,
      "user/attached.md",
      async () => { permissionAsked = true; return true; },
      undefined,
      sessionAllowedPaths,
    );
    expect(permissionAsked).toBe(false);
    expect(readFileSync(join(rootDir, "user/attached.md"), "utf8")).toBe("attached content");
  });

  it("moveWorkspaceFile moves within user workspace", async () => {
    await setupRepo();
    writeFileSync(join(rootDir, "user/old.md"), "content");
    await simpleGit(rootDir).add("user/old.md").commit("seed");

    await moveWorkspaceFile(rootDir, "user/old.md", "user/projects/new.md");
    expect(existsSync(join(rootDir, "user/old.md"))).toBe(false);
    expect(readFileSync(join(rootDir, "user/projects/new.md"), "utf8")).toBe("content");
  });

  it("rewrites markdown links when moving brain files", async () => {
    await setupRepo();
    mkdirSync(join(rootDir, "agent_brain", "concepts"), { recursive: true });
    writeFileSync(join(rootDir, "agent_brain/concepts/x.md"), "concept");
    writeFileSync(join(rootDir, "agent_brain/concepts/index.md"), "See [X](x.md).");
    await simpleGit(rootDir).add("agent_brain/concepts").commit("seed");

    const result = await moveWorkspaceFile(
      rootDir,
      "agent_brain/concepts/x.md",
      "agent_brain/concepts/cluster/x.md",
    );
    expect(existsSync(join(rootDir, "agent_brain/concepts/cluster/x.md"))).toBe(true);
    expect(readFileSync(join(rootDir, "agent_brain/concepts/index.md"), "utf8")).toContain(
      "cluster/x.md",
    );
    expect(result).toContain("Updated links in");
  });

  it("reports no links to update when moving brain file without references", async () => {
    await setupRepo();
    mkdirSync(join(rootDir, "agent_brain", "ideas"), { recursive: true });
    writeFileSync(join(rootDir, "agent_brain/ideas/seed.md"), "idea");
    await simpleGit(rootDir).add("agent_brain/ideas/seed.md").commit("seed");

    const result = await moveWorkspaceFile(
      rootDir,
      "agent_brain/ideas/seed.md",
      "agent_brain/ideas/2026-08-16_seed.md",
    );
    expect(result).toContain("No links to update");
  });

  it("executeFileTool surfaces validation errors for protected brain files", async () => {
    await setupRepo();
    mkdirSync(join(rootDir, "agent_brain", "concepts"), { recursive: true });
    writeFileSync(join(rootDir, "agent_brain/concepts/foo.md"), "x");
    const tools = buildFileTools(rootDir);
    await expect(
      executeFileTool(tools, "delete_file", { path: "agent_brain/observations.md" }),
    ).rejects.toThrow(/not allowed/);
  });
});

describe("FileToolError", () => {
  it("is instanceof Error", () => {
    expect(new FileToolError("test")).toBeInstanceOf(Error);
  });
});
