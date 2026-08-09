// backends/consolidation-relocate.ts — Brain file relocation with link rewriting (FR-CONSOL-07).

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { containedRelPath, isContained, realPathOrNearest } from "./containment";
import { gitClient } from "./git";
import { BRAIN_PREFIX } from "../shared/brain-paths";
import { windowsFilenameIssue } from "../shared/filename-safety";

const MARKDOWN_LINK_RE = /(?<!!)\[([^\]]*)\]\(([^)]+)\)/g;
const EXTERNAL_LINK_RE = /^(?:https?:|mailto:|#)/i;

function normalizeRepoPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function listMarkdownFiles(rootDir: string): string[] {
  const files: string[] = [];

  function walk(current: string): void {
    for (const entry of readdirSync(current)) {
      if (entry === ".git") continue;
      const abs = join(current, entry);
      const stat = statSync(abs);
      if (stat.isDirectory()) {
        walk(abs);
      } else if (entry.endsWith(".md")) {
        files.push(abs);
      }
    }
  }

  if (existsSync(rootDir)) walk(rootDir);
  return files;
}

function resolveMarkdownLink(rootDir: string, fromRelPath: string, href: string): string | null {
  const pathPart = href.split("#")[0]?.split("?")[0] ?? "";
  if (!pathPart || EXTERNAL_LINK_RE.test(pathPart)) return null;

  const fromDir = dirname(join(rootDir, fromRelPath));
  // Leading `/` in markdown is repo-root-relative (POSIX convention in links),
  // not an OS absolute path.
  const abs = resolve(
    pathPart.startsWith("/") ? join(rootDir, pathPart.slice(1)) : join(fromDir, pathPart),
  );
  // NFR-PORT-07 / spike A6: do not re-implement containment with
  // `startsWith(root + "/")` — after `normalize` on win32 the root uses `\` and
  // every in-repo link fails the check, so rewriteBrokenLinks rewrites nothing
  // and reports success. Use the single containment authority (NFR-SEC-16).
  if (!isContained(abs, rootDir)) return null;
  return realPathOrNearest(abs);
}

function relativeMarkdownLink(rootDir: string, fromRelPath: string, targetAbs: string): string {
  const fromDir = dirname(join(rootDir, fromRelPath));
  return normalizeRepoPath(relative(fromDir, targetAbs));
}

/** Rewrite markdown links that pointed at `oldPath` to use `newPath` instead. */
export function rewriteBrokenLinks(
  rootDir: string,
  oldPath: string,
  newPath: string,
): string[] {
  const oldAbs = realPathOrNearest(join(rootDir, normalizeRepoPath(oldPath)));
  const newAbs = realPathOrNearest(join(rootDir, normalizeRepoPath(newPath)));
  const rewritten: string[] = [];

  for (const absFile of listMarkdownFiles(rootDir)) {
    const relFile = normalizeRepoPath(relative(rootDir, absFile));
    const original = readFileSync(absFile, "utf8");
    let changed = false;

    const updated = original.replace(MARKDOWN_LINK_RE, (match, text: string, href: string) => {
      const resolved = resolveMarkdownLink(rootDir, relFile, href);
      if (!resolved || realPathOrNearest(resolved) !== oldAbs) return match;

      const suffix = href.includes("#")
        ? href.slice(href.indexOf("#"))
        : href.includes("?")
          ? href.slice(href.indexOf("?"))
          : "";
      changed = true;
      const newHref = relativeMarkdownLink(rootDir, relFile, newAbs);
      return `[${text}](${newHref}${suffix})`;
    });

    if (changed) {
      writeFileSync(absFile, updated);
      rewritten.push(relFile);
    }
  }

  return rewritten;
}

export class RelocateBrainFileError extends Error {}

/**
 * Resolve an argument to a path inside `agent_brain/`, or throw (NFR-SEC-16).
 *
 * The previous rule was `startsWith("agent_brain/")` applied to the raw string,
 * which `agent_brain/../.pi/settings.json` satisfies — `join` then collapsed the
 * `..` and the tool git-mv'd the model configuration that the permission layer
 * explicitly refuses to let the agent write (NFR-SEC-06). Containment is now
 * decided by `containedRelPath`, and the prefix is checked on the *resolved*
 * path rather than on the spelling.
 */
function assertBrainPath(rootDir: string, raw: string, label: string): string {
  const abs = resolve(rootDir, normalizeRepoPath(raw));
  const filenameIssue = windowsFilenameIssue(abs);
  if (filenameIssue) {
    throw new RelocateBrainFileError(`${label}: ${filenameIssue}`);
  }
  const relPath = containedRelPath(rootDir, abs);
  if (relPath === null || !relPath.startsWith(BRAIN_PREFIX)) {
    throw new RelocateBrainFileError(`${label} must be within agent_brain/`);
  }
  return relPath;
}

/** Move a file within agent_brain/ via git mv and rewrite incoming markdown links. */
export async function relocateBrainFile(
  rootDir: string,
  source: string,
  destination: string,
): Promise<{ rewrittenLinks: string[] }> {
  const src = assertBrainPath(rootDir, source, "source");
  const dst = assertBrainPath(rootDir, destination, "destination");

  const srcAbs = join(rootDir, src);
  if (!existsSync(srcAbs)) {
    throw new RelocateBrainFileError(`source does not exist: ${src}`);
  }

  mkdirSync(dirname(join(rootDir, dst)), { recursive: true });
  await gitClient(rootDir).mv(src, dst);

  const rewrittenLinks = rewriteBrokenLinks(rootDir, src, dst);
  return { rewrittenLinks };
}
