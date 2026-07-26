// backends/brain-health.ts — Brain health linter for consolidation prompts (FR-BRAIN-07).

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import {
  BRAIN_FILE_SIZE_THRESHOLD_LINES,
  BRAIN_INDEX_EXEMPT_DIRS,
  BRAIN_INDEX_EXEMPT_ROOT,
  CORE_BRAIN_FILES,
  CORE_ROOT_FILES,
  FRONTMATTER_EXEMPT_FILES,
  REQUIRED_BRAIN_FRONTMATTER,
} from "../shared/defaults";
import { parseFrontmatter } from "./reflect";

export interface BrainHealthReport {
  missingFrontmatter: string[];
  missingCoreFiles: string[];
  missingIndexes: string[];
  oversizedFiles: string[];
}

function isArchivePath(relPath: string): boolean {
  return relPath === "agent_brain/archive" || relPath.startsWith("agent_brain/archive/");
}

function walkAllBrainMarkdown(rootDir: string): string[] {
  const brainDir = join(rootDir, "agent_brain");
  if (!existsSync(brainDir)) return [];

  const results: string[] = [];
  const stack = [brainDir];

  while (stack.length > 0) {
    const current = stack.pop()!;
    const relDir = relative(rootDir, current).replace(/\\/g, "/");
    if (isArchivePath(relDir)) continue;

    for (const entry of readdirSync(current)) {
      const abs = join(current, entry);
      const rel = relative(rootDir, abs).replace(/\\/g, "/");
      if (statSync(abs).isDirectory()) {
        if (!isArchivePath(rel)) stack.push(abs);
      } else if (rel.startsWith("agent_brain/") && rel.endsWith(".md")) {
        results.push(rel);
      }
    }
  }

  return results.sort();
}

function hasRequiredFrontmatter(content: string): boolean {
  const fields = parseFrontmatter(content);
  return REQUIRED_BRAIN_FRONTMATTER.every(
    (key) => key in fields && fields[key].trim().length > 0,
  );
}

function isIndexExemptDir(relDir: string): boolean {
  if (relDir === BRAIN_INDEX_EXEMPT_ROOT) return true;
  return BRAIN_INDEX_EXEMPT_DIRS.some(
    (exempt) => relDir === exempt || relDir.startsWith(`${exempt}/`),
  );
}

function findMissingIndexes(rootDir: string): string[] {
  const brainDir = join(rootDir, "agent_brain");
  if (!existsSync(brainDir)) return [];

  const missing: string[] = [];
  const stack = [brainDir];

  while (stack.length > 0) {
    const current = stack.pop()!;
    const relDir = relative(rootDir, current).replace(/\\/g, "/");
    if (isArchivePath(relDir)) continue;

    const entries = readdirSync(current);
    const subdirs = entries.filter((entry) => statSync(join(current, entry)).isDirectory());
    for (const subdir of subdirs) {
      const abs = join(current, subdir);
      const rel = relative(rootDir, abs).replace(/\\/g, "/");
      if (!isArchivePath(rel)) stack.push(abs);
    }

    if (isIndexExemptDir(relDir)) continue;

    const mdFiles = entries.filter(
      (entry) => entry.endsWith(".md") && statSync(join(current, entry)).isFile(),
    );
    if (mdFiles.length <= 1) continue;
    if (mdFiles.includes("index.md")) continue;

    missing.push(relDir);
  }

  return missing.sort();
}

export function computeBrainHealthReport(rootDir: string): BrainHealthReport {
  const missingFrontmatter: string[] = [];
  const oversizedFiles: string[] = [];

  for (const relPath of walkAllBrainMarkdown(rootDir)) {
    const content = readFileSync(join(rootDir, relPath), "utf8");
    if (
      !(FRONTMATTER_EXEMPT_FILES as readonly string[]).includes(relPath) &&
      !hasRequiredFrontmatter(content)
    ) {
      missingFrontmatter.push(relPath);
    }
    if (content.split("\n").length > BRAIN_FILE_SIZE_THRESHOLD_LINES) {
      oversizedFiles.push(relPath);
    }
  }

  const missingCoreFiles: string[] = [];
  for (const relPath of CORE_BRAIN_FILES) {
    if (!existsSync(join(rootDir, relPath))) {
      missingCoreFiles.push(relPath);
    }
  }
  const hasRootOverlay = CORE_ROOT_FILES.some((file) => existsSync(join(rootDir, file)));
  if (!hasRootOverlay) {
    missingCoreFiles.push("AGENTS.md or CLAUDE.md");
  }

  const missingIndexes = findMissingIndexes(rootDir);

  return {
    missingFrontmatter,
    missingCoreFiles,
    missingIndexes,
    oversizedFiles,
  };
}

export function formatBrainHealthReportBlock(report: BrainHealthReport): string {
  const hasIssues =
    report.missingFrontmatter.length > 0 ||
    report.missingCoreFiles.length > 0 ||
    report.missingIndexes.length > 0 ||
    report.oversizedFiles.length > 0;

  if (!hasIssues) return "";

  const lines = ["Brain health (pre-computed):"];

  if (report.missingFrontmatter.length > 0) {
    lines.push("Missing frontmatter:");
    for (const path of report.missingFrontmatter) {
      lines.push(`- ${path}`);
    }
  }

  if (report.missingCoreFiles.length > 0) {
    lines.push("Missing core files:");
    for (const path of report.missingCoreFiles) {
      lines.push(`- ${path}`);
    }
  }

  if (report.missingIndexes.length > 0) {
    lines.push("Missing index.md:");
    for (const path of report.missingIndexes) {
      lines.push(`- ${path}`);
    }
  }

  if (report.oversizedFiles.length > 0) {
    lines.push("Oversized files:");
    for (const path of report.oversizedFiles) {
      lines.push(`- ${path}`);
    }
  }

  return lines.join("\n");
}
