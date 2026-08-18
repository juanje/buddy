// backends/grouping-candidates.ts — Grouping candidates detection (FR-CONSOL-22).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { brainDirPath } from "./brain-paths";

export interface GroupingCandidate {
  directory: string;
  keyword: string;
  files: string[];
}

const GROUPING_DIRS = ["concepts", "ideas", "skills"] as const;
const GROUPING_THRESHOLD = 3;

function listRootMarkdownFiles(rootDir: string, subdir: string): string[] {
  const dir = join(brainDirPath(rootDir), subdir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "index.md")
    .map((entry) => entry.name);
}

function readSummary(rootDir: string, subdir: string, filename: string): string {
  const path = join(brainDirPath(rootDir), subdir, filename);
  const content = readFileSync(path, "utf8");
  const match = content.match(/^---\n[\s\S]*?summary:\s*(.+)\n[\s\S]*?---/);
  return (match?.[1] ?? filename.replace(/\.md$/, "")).toLowerCase();
}

function keywordTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4);
}

export function detectGroupingCandidates(rootDir: string): GroupingCandidate[] {
  const candidates: GroupingCandidate[] = [];

  for (const subdir of GROUPING_DIRS) {
    const files = listRootMarkdownFiles(rootDir, subdir);
    if (files.length < GROUPING_THRESHOLD) continue;

    const keywordMap = new Map<string, string[]>();
    for (const file of files) {
      const summary = readSummary(rootDir, subdir, file);
      for (const keyword of keywordTokens(summary)) {
        const list = keywordMap.get(keyword) ?? [];
        list.push(file);
        keywordMap.set(keyword, list);
      }
    }

    for (const [keyword, grouped] of keywordMap.entries()) {
      const unique = [...new Set(grouped)];
      if (unique.length >= GROUPING_THRESHOLD) {
        candidates.push({ directory: `agent_brain/${subdir}/`, keyword, files: unique });
      }
    }
  }

  return candidates.sort((a, b) => b.files.length - a.files.length);
}

export function formatGroupingCandidatesBlock(candidates: GroupingCandidate[]): string {
  if (candidates.length === 0) {
    return "Grouping candidates:\nNo clusters of 3+ related files at directory roots.";
  }

  const lines = ["Grouping candidates:"];
  for (const candidate of candidates.slice(0, 10)) {
    lines.push(
      `- ${candidate.directory} keyword "${candidate.keyword}" (${candidate.files.length} files): ${candidate.files.slice(0, 5).join(", ")}`,
    );
  }
  return lines.join("\n");
}
