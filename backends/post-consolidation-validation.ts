// backends/post-consolidation-validation.ts — FR-GUARD-03: filename + link repair.

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";

import { logEvent } from "./app-logger";

const VALID_PATH = /^[a-z0-9._\-/]+$/;
const MARKDOWN_LINK = /\[([^\]]*)\]\(([^)]+)\)/g;

export interface RenameResult {
  from: string;
  to: string;
}

export interface LinkRepairResult {
  file: string;
  target: string;
  display: string;
}

export interface PostConsolidationValidationResult {
  renames: RenameResult[];
  linkRepairs: LinkRepairResult[];
}

/** True when every path segment uses lowercase kebab-safe characters. */
export function isValidBrainFilename(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, "/");
  if (!VALID_PATH.test(normalized)) return false;
  const base = basename(normalized);
  return base === base.toLowerCase() && !/\s/.test(base);
}

/** Slug-normalize a repo-relative path (lowercase, spaces → hyphens). */
export function slugifyFilename(relPath: string): string {
  const normalized = relPath.replace(/\\/g, "/");
  const dir = dirname(normalized);
  const base = basename(normalized);
  const ext = extname(base);
  const stem = basename(base, ext);
  const slug = stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const newBase = `${slug || "file"}${ext.toLowerCase()}`;
  return dir === "." ? newBase : `${dir}/${newBase}`.replace(/\\/g, "/");
}

export interface BrokenLinkMatch {
  start: number;
  end: number;
  display: string;
  target: string;
}

/** Find relative markdown links in content whose targets are missing on disk. */
export function findBrokenLinks(
  content: string,
  fileRelPath: string,
  rootDir: string,
): BrokenLinkMatch[] {
  const broken: BrokenLinkMatch[] = [];
  const fileDir = dirname(fileRelPath.replace(/\\/g, "/"));

  for (const match of content.matchAll(MARKDOWN_LINK)) {
    const display = match[1] ?? "";
    const target = (match[2] ?? "").trim();
    if (!target || /^https?:\/\//i.test(target) || target.startsWith("#")) continue;

    const withoutAnchor = target.split("#")[0] ?? target;
    if (!withoutAnchor) continue;

    const resolved = resolve(rootDir, fileDir, withoutAnchor);
    if (!existsSync(resolved)) {
      broken.push({
        start: match.index ?? 0,
        end: (match.index ?? 0) + match[0].length,
        display,
        target,
      });
    }
  }

  return broken;
}

/** Replace one markdown link span with its display text. */
export function stripBrokenLink(content: string, link: BrokenLinkMatch): string {
  return content.slice(0, link.start) + link.display + content.slice(link.end);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rewriteLinksForRename(
  content: string,
  fromRel: string,
  toRel: string,
): string {
  const fromPath = fromRel.replace(/\\/g, "/");
  const toPath = toRel.replace(/\\/g, "/");
  const fromBase = basename(fromPath);
  const toBase = basename(toPath);

  let updated = content.replaceAll(`(${fromPath})`, `(${toPath})`);
  updated = updated.replace(
    new RegExp(`\\(([^)]*/)?${escapeRegex(fromBase)}\\)`, "g"),
    (_match, prefix: string | undefined) => `(${prefix ?? ""}${toBase})`,
  );
  return updated;
}

function isMarkdownPath(relPath: string): boolean {
  return relPath.endsWith(".md");
}

/** Rename invalid new files and rewrite links in touched markdown files. */
export function validateAndFixFilenames(
  rootDir: string,
  newFiles: string[],
  touchedFiles: string[],
): RenameResult[] {
  const renames: RenameResult[] = [];
  const renameMap = new Map<string, string>();

  for (const rel of newFiles) {
    const normalized = rel.replace(/\\/g, "/");
    if (isValidBrainFilename(normalized)) continue;

    let candidate = slugifyFilename(normalized);
    let counter = 2;
    while (existsSync(join(rootDir, candidate)) && candidate !== normalized) {
      const dir = dirname(candidate);
      const base = basename(candidate, extname(candidate));
      const ext = extname(candidate);
      const suffixed = `${base}-${counter}${ext}`;
      candidate = dir === "." ? suffixed : `${dir}/${suffixed}`;
      counter += 1;
    }

    if (candidate === normalized) continue;

    renameSync(join(rootDir, normalized), join(rootDir, candidate));
    renameMap.set(normalized, candidate);
    renames.push({ from: normalized, to: candidate });
    logEvent(rootDir, {
      event: "post_consolidation_rename",
      from: normalized,
      to: candidate,
    });
  }

  if (renameMap.size === 0) return renames;

  for (const rel of touchedFiles) {
    if (!isMarkdownPath(rel)) continue;
    const abs = join(rootDir, rel);
    if (!existsSync(abs)) continue;
    let content = readFileSync(abs, "utf8");
    let changed = false;
    for (const [from, to] of renameMap) {
      const updated = rewriteLinksForRename(content, from, to);
      if (updated !== content) {
        content = updated;
        changed = true;
      }
    }
    if (changed) writeFileSync(abs, content, "utf8");
  }

  return renames;
}

/** Strip broken relative links in touched markdown files. */
export function repairBrokenLinks(
  rootDir: string,
  touchedFiles: string[],
): LinkRepairResult[] {
  const repairs: LinkRepairResult[] = [];

  for (const rel of touchedFiles) {
    if (!isMarkdownPath(rel)) continue;
    const abs = join(rootDir, rel);
    if (!existsSync(abs)) continue;

    let content = readFileSync(abs, "utf8");
    let broken = findBrokenLinks(content, rel, rootDir);
    if (broken.length === 0) continue;

    // Apply from end to start so indices stay valid.
    broken = broken.sort((a, b) => b.start - a.start);
    for (const link of broken) {
      content = stripBrokenLink(content, link);
      repairs.push({ file: rel, target: link.target, display: link.display });
      logEvent(rootDir, {
        event: "post_consolidation_link_repair",
        file: rel,
        target: link.target,
      });
    }
    writeFileSync(abs, content, "utf8");
  }

  return repairs;
}

/** Run filename validation then broken-link repair on a consolidation delta. */
export function runPostConsolidationValidation(
  rootDir: string,
  newFiles: string[],
  touchedFiles: string[],
): PostConsolidationValidationResult {
  const normalizedNew = newFiles.map((p) => p.replace(/\\/g, "/"));
  const normalizedTouched = touchedFiles.map((p) => p.replace(/\\/g, "/"));
  const renames = validateAndFixFilenames(rootDir, normalizedNew, normalizedTouched);

  const renamedPaths = new Map(renames.map((r) => [r.from, r.to]));
  const filesAfterRename = normalizedTouched.map((p) => renamedPaths.get(p) ?? p);
  const linkRepairs = repairBrokenLinks(rootDir, filesAfterRename);

  return { renames, linkRepairs };
}

/** Collect repo-relative paths changed since a git ref (added + modified). */
export async function listChangedFilesSince(
  sinceRef: string,
  gitStatus: () => Promise<{ not_added: string[] }>,
  gitDiffNameOnly: (args: string[]) => Promise<string>,
): Promise<{ newFiles: string[]; touchedFiles: string[] }> {
  const diffOutput = await gitDiffNameOnly(["--name-only", "--diff-filter=AM", sinceRef]);
  const addedOutput = await gitDiffNameOnly(["--name-only", "--diff-filter=A", sinceRef]);
  const status = await gitStatus();

  const touched = new Set<string>();
  for (const line of diffOutput.split("\n")) {
    const trimmed = line.trim();
    if (trimmed) touched.add(trimmed);
  }
  for (const line of status.not_added) {
    if (line.trim()) touched.add(line.trim());
  }

  const newFiles = new Set<string>();
  for (const line of addedOutput.split("\n")) {
    const trimmed = line.trim();
    if (trimmed) newFiles.add(trimmed);
  }
  for (const line of status.not_added) {
    if (line.trim()) newFiles.add(line.trim());
  }

  return {
    newFiles: [...newFiles],
    touchedFiles: [...touched],
  };
}

/** Resolve a repo-relative path for logging. */
export function relPathFromRoot(rootDir: string, absPath: string): string {
  return relative(rootDir, absPath).replace(/\\/g, "/");
}
