// tests/unit/file-tools.test.ts — FR-DELETE-01, FR-FILE-01, FR-FILE-02.

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
  moveWorkspaceFile,
  validateCopyDestination,
  validateDeletablePath,
  validateMoveDestination,
  validateMoveSource,
} from "../../backends/file-tools";
import { initTestGitRepo } from "../support/test-git";

describe("validateDeletablePath", () => {
  const rootDir = "/buddy";

  it("allows user/ paths", () => {
    expect(validateDeletablePath(rootDir, "user/inbox.md")).toEqual({
      absPath: join(rootDir, "user/inbox.md"),
      relPath: "user/inbox.md",
    });
  });

  it("rejects agent_brain paths", () => {
    expect(() => validateDeletablePath(rootDir, "agent_brain/concepts/foo.md")).toThrow(
      /not allowed/,
    );
  });

  it("rejects identity files", () => {
    expect(() => validateDeletablePath(rootDir, "AGENTS.md")).toThrow(/not allowed/);
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

  it("rejects agent_brain source", () => {
    expect(() => validateMoveSource(rootDir, "agent_brain/x.md")).toThrow(/not allowed/);
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
    writeFileSync(join(rootDir, "user/inbox.md"), "task");
    await simpleGit(rootDir).add("user/inbox.md").commit("seed");

    await deleteWorkspaceFile(rootDir, "user/inbox.md", async () => true);
    expect(existsSync(join(rootDir, "user/inbox.md"))).toBe(false);
  });

  it("deleteWorkspaceFile returns declined when not confirmed", async () => {
    await setupRepo();
    writeFileSync(join(rootDir, "user/inbox.md"), "task");

    const result = await deleteWorkspaceFile(rootDir, "user/inbox.md", async () => false);
    expect(result).toContain("declined");
    expect(existsSync(join(rootDir, "user/inbox.md"))).toBe(true);
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

  it("executeFileTool surfaces validation errors", async () => {
    await setupRepo();
    const tools = buildFileTools(rootDir);
    await expect(
      executeFileTool(tools, "delete_file", { path: "agent_brain/x.md" }),
    ).rejects.toThrow(/not allowed/);
  });
});

describe("FileToolError", () => {
  it("is instanceof Error", () => {
    expect(new FileToolError("test")).toBeInstanceOf(Error);
  });
});
