// backends/brain-health.ts — Brain health linter for consolidation prompts (FR-BRAIN-07).

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import {
  BRAIN_FILE_SIZE_THRESHOLD_LINES,
  BRAIN_HEALTH_REPAIR_BUDGET,
  BRAIN_INDEX_EXEMPT_DIRS,
  BRAIN_INDEX_EXEMPT_ROOT,
  CORE_BRAIN_FILES,
  CORE_ROOT_FILES,
  FRONTMATTER_EXEMPT_FILES,
  REQUIRED_BRAIN_FRONTMATTER,
} from "../shared/defaults";
import { parseFrontmatter } from "./reflect";
import { brainDirPath } from "./brain-paths";

export interface BrainHealthReport {
  /**
   * Files whose frontmatter block exists but lacks required keys
   * (NFR-FORMAT-01). Each entry names what is absent: the report is read by a
   * model, and "this file is missing frontmatter" about a file that visibly
   * has frontmatter is an instruction it will correctly ignore.
   */
  missingFrontmatter: Array<{ path: string; missing: string[] }>;
  /**
   * Files whose frontmatter exists but is structurally broken (NFR-FORMAT-01):
   * a second `---` block stacked below the first, or a key repeated inside one
   * block. Kept separate from `missingFrontmatter` because it is damage rather
   * than omission — and because this is the shape a consolidation produces when
   * it appends instead of merging.
   */
  malformedFrontmatter: Array<{ path: string; problem: string }>;
  missingCoreFiles: string[];
  missingIndexes: string[];
  oversizedFiles: string[];
}

const FRONTMATTER_BLOCK = /^---\n([\s\S]*?)\n---\n/;

/**
 * Describe what is structurally wrong with a file's frontmatter, or null.
 *
 * Both shapes detected here were written by a *model*, not by our code: a
 * consolidation appending a whole new block below the existing one instead of
 * merging into it, and one adding a key already present. The first is how
 * `agent_brain/concepts/local-link-routing.md` came to claim two different
 * `created` dates — one of them earlier than the file itself.
 */
export function frontmatterProblem(content: string): string | null {
  if (!content.startsWith("---\n")) return null; // absent — that is missingFrontmatter
  const block = FRONTMATTER_BLOCK.exec(content);
  if (!block) return "frontmatter block is not terminated";

  const keys = (block[1].match(/^(\w+):/gm) ?? []).map((key) => key.slice(0, -1));
  const duplicated = [...new Set(keys.filter((key, i) => keys.indexOf(key) !== i))];
  if (duplicated.length > 0) return `duplicated key: ${duplicated.join(", ")}`;

  if (FRONTMATTER_BLOCK.test(content.slice(block[0].length).replace(/^\s*/, ""))) {
    return "a second frontmatter block follows the first";
  }
  return null;
}

function isArchivePath(relPath: string): boolean {
  return relPath === "agent_brain/archive" || relPath.startsWith("agent_brain/archive/");
}

function walkAllBrainMarkdown(rootDir: string): string[] {
  const brainDir = brainDirPath(rootDir);
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

/** Which required keys are absent or empty (NFR-FORMAT-01). */
function missingRequiredKeys(content: string): string[] {
  const fields = parseFrontmatter(content);
  return REQUIRED_BRAIN_FRONTMATTER.filter(
    (key) => !(key in fields) || fields[key].trim().length === 0,
  );
}

function isIndexExemptDir(relDir: string): boolean {
  if (relDir === BRAIN_INDEX_EXEMPT_ROOT) return true;
  return BRAIN_INDEX_EXEMPT_DIRS.some(
    (exempt) => relDir === exempt || relDir.startsWith(`${exempt}/`),
  );
}

function findMissingIndexes(rootDir: string): string[] {
  const brainDir = brainDirPath(rootDir);
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
  const missingFrontmatter: BrainHealthReport["missingFrontmatter"] = [];
  const malformedFrontmatter: BrainHealthReport["malformedFrontmatter"] = [];
  const oversizedFiles: string[] = [];

  for (const relPath of walkAllBrainMarkdown(rootDir)) {
    const content = readFileSync(join(rootDir, relPath), "utf8");
    if (!(FRONTMATTER_EXEMPT_FILES as readonly string[]).includes(relPath)) {
      const missing = missingRequiredKeys(content);
      if (missing.length > 0) missingFrontmatter.push({ path: relPath, missing });
    }
    const problem = frontmatterProblem(content);
    if (problem) malformedFrontmatter.push({ path: relPath, problem });
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
    malformedFrontmatter,
    missingCoreFiles,
    missingIndexes,
    oversizedFiles,
  };
}

export function formatBrainHealthReportBlock(report: BrainHealthReport): string {
  const hasIssues =
    report.missingFrontmatter.length > 0 ||
    report.malformedFrontmatter.length > 0 ||
    report.missingCoreFiles.length > 0 ||
    report.missingIndexes.length > 0 ||
    report.oversizedFiles.length > 0;

  if (!hasIssues) return "";

  const lines = ["Brain health (pre-computed):"];

  if (report.missingFrontmatter.length > 0) {
    // The label used to read "Missing frontmatter", which is false for almost
    // every file listed: they have a block, they are missing required *keys*.
    // A model told the frontmatter is missing opens the file, sees frontmatter,
    // and reasonably concludes there is nothing to do — which is exactly what
    // happened on 2026-07-28, when 60 files were reported and none was fixed.
    // Naming the absent keys turns the list into an instruction.
    const shown = report.missingFrontmatter.slice(0, BRAIN_HEALTH_REPAIR_BUDGET);
    const remaining = report.missingFrontmatter.length - shown.length;
    lines.push(
      `Incomplete frontmatter — the block exists, these keys are absent. ` +
        `Fix the ${shown.length} listed here in this pass:`,
    );
    for (const entry of shown) {
      lines.push(`- ${entry.path} — add: ${entry.missing.join(", ")}`);
    }
    if (remaining > 0) {
      // A list of sixty is not a task, it is a wall. Later passes take the rest.
      lines.push(`(${remaining} more will be listed in later consolidations.)`);
    }
  }

  if (report.malformedFrontmatter.length > 0) {
    // Spelled out rather than listed, because the fix is a merge and the model
    // has to be told not to append — appending is how these arose.
    lines.push(
      "Malformed frontmatter (repair by merging into ONE block, never by adding another):",
    );
    for (const { path, problem } of report.malformedFrontmatter) {
      lines.push(`- ${path} — ${problem}`);
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
