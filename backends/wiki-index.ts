// backends/wiki-index.ts — Regenerate wiki index and glossary (FR-WIKI-01).

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { toIsoDay } from "../shared/dates";
import { WIKI_DIR, WIKI_GLOSSARY, WIKI_INDEX, WIKI_TAGS } from "../shared/brain-paths";
import { buddyPath } from "./brain-paths";
import {
  WIKI_META_FILES,
  extractTitle,
  humanizeCategorySlug,
  parseWikiFrontmatter,
  resolveWikiLanguage,
  type WikiLanguage,
  type WikiPageMetadata,
} from "./wiki-format";

const FALLBACK_SUMMARY_MAX = 200;

const WIKI_META_HEADINGS: Record<WikiLanguage, { glossary: string }> = {
  en: { glossary: "Glossary" },
  es: { glossary: "Glosario" },
};

/** First complete sentence from summary; fallback truncates at 200 chars. */
export function firstSentence(summary: string): string {
  const trimmed = summary.trim();
  if (!trimmed) return trimmed;

  const periodSpace = trimmed.search(/\.\s+/);
  if (periodSpace !== -1) {
    return trimmed.slice(0, periodSpace + 1);
  }
  if (trimmed.endsWith(".")) {
    return trimmed;
  }
  if (trimmed.length <= FALLBACK_SUMMARY_MAX) return trimmed;
  return `${trimmed.slice(0, FALLBACK_SUMMARY_MAX - 3).trimEnd()}...`;
}

function metaHeadings(language?: string): { glossary: string } {
  return WIKI_META_HEADINGS[resolveWikiLanguage(language)];
}

export function listWikiPageRelPaths(wikiDir: string): string[] {
  if (!existsSync(wikiDir)) return [];

  const pages: string[] = [];
  function walk(current: string): void {
    for (const entry of readdirSync(current)) {
      if (entry.startsWith(".")) continue;
      const abs = join(current, entry);
      const stat = statSync(abs);
      if (stat.isDirectory()) {
        walk(abs);
      } else if (entry.endsWith(".md")) {
        const rel = relative(wikiDir, abs).split("\\").join("/");
        if (WIKI_META_FILES.has(rel)) continue;
        pages.push(rel);
      }
    }
  }
  walk(wikiDir);
  return pages.sort((a, b) => a.localeCompare(b));
}

export function loadWikiPages(rootDir: string): WikiPageMetadata[] {
  const wikiDir = buddyPath(rootDir, WIKI_DIR);
  return listWikiPageRelPaths(wikiDir).map((relPath) => {
    const content = readFileSync(join(wikiDir, relPath), "utf8");
    const fm = parseWikiFrontmatter(content);
    return {
      relPath,
      title: extractTitle(content),
      summary: fm.summary,
      tags: fm.tags,
      category: relPath.includes("/") ? relPath.split("/")[0] : "",
      connections: [],
    };
  });
}

export function renderWikiIndex(pages: WikiPageMetadata[], _language?: WikiLanguage): string {
  const lines = ["# Wiki", ""];
  const byCategory = new Map<string, WikiPageMetadata[]>();

  for (const page of pages) {
    const category = page.category || "uncategorized";
    const list = byCategory.get(category) ?? [];
    list.push(page);
    byCategory.set(category, list);
  }

  for (const category of [...byCategory.keys()].sort()) {
    lines.push(`## ${humanizeCategorySlug(category)}`);
    const categoryPages = byCategory.get(category)!.sort((a, b) => a.title.localeCompare(b.title));
    for (const page of categoryPages) {
      const linkPath = page.relPath;
      const summary = page.summary ? ` — ${page.summary}` : "";
      lines.push(`- [${page.title}](${linkPath})${summary}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

/** Maintenance-only tag index; not regenerated on every wiki_file call. */
export function renderTagsFile(pages: WikiPageMetadata[], generatedDay: string): string {
  const tagMap = new Map<string, WikiPageMetadata[]>();
  for (const page of pages) {
    for (const tag of page.tags) {
      const list = tagMap.get(tag) ?? [];
      list.push(page);
      tagMap.set(tag, list);
    }
  }

  const lines = [
    "# Tag index",
    "",
    `*Generated: ${generatedDay} — ${pages.length} pages, ${tagMap.size} tags*`,
    "",
  ];

  for (const tag of [...tagMap.keys()].sort()) {
    lines.push(`## ${tag}`);
    const tagged = tagMap.get(tag)!.sort((a, b) => a.title.localeCompare(b.title));
    for (const page of tagged) {
      const summary = page.summary ? ` — ${page.summary}` : "";
      lines.push(`- [${page.title}](${page.relPath})${summary}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

export function renderGlossary(pages: WikiPageMetadata[], language?: WikiLanguage): string {
  const headings = metaHeadings(language);
  const lines = [`# ${headings.glossary}`, ""];
  const sorted = [...pages].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));

  for (const page of sorted) {
    const summary = firstSentence(page.summary);
    lines.push(`- **[${page.title}](${page.relPath})** — ${summary}`);
  }
  lines.push("");

  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

export function regenerateWikiIndex(
  rootDir: string,
  _now: Date = new Date(),
  language?: WikiLanguage,
): void {
  const wikiDir = buddyPath(rootDir, WIKI_DIR);
  mkdirSync(wikiDir, { recursive: true });
  const pages = loadWikiPages(rootDir);

  writeFileSync(buddyPath(rootDir, WIKI_INDEX), renderWikiIndex(pages, language), "utf8");
  writeFileSync(buddyPath(rootDir, WIKI_GLOSSARY), renderGlossary(pages, language), "utf8");
}

export function regenerateTagsFile(rootDir: string, now: Date = new Date()): void {
  const pages = loadWikiPages(rootDir);
  writeFileSync(buddyPath(rootDir, WIKI_TAGS), renderTagsFile(pages, toIsoDay(now)), "utf8");
}

export function regenerateGlossary(rootDir: string, language?: WikiLanguage): void {
  const pages = loadWikiPages(rootDir);
  writeFileSync(buddyPath(rootDir, WIKI_GLOSSARY), renderGlossary(pages, language), "utf8");
}
