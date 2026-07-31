// shared/frontmatter.ts — reading YAML frontmatter, browser-safe.
//
// This lived in `backends/reflect.ts`, which imports `node:fs` and so cannot be
// reached from the frontend. FR-CHAT-15 needs the same parsing in the file
// viewer, and a second implementation of "what does this file's frontmatter
// say" is the shape of defect this project keeps paying for — four helpers once
// answered "is this path inside the buddy directory?" and the fourth was wrong.
// So it moved here rather than being copied.
//
// Deliberately not a YAML parser. Frontmatter in a buddy directory is flat
// `key: value` lines written by the worker and by the agent under instruction.
// Values are kept as raw strings; nothing here interprets types.

/** The frontmatter block: `---` on the first line, `---` closing it. */
const FRONTMATTER_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---/;

/**
 * Frontmatter fields as raw strings. An empty object when the file has none —
 * absence and emptiness are not distinguished, because no caller needs to.
 */
export function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(FRONTMATTER_BLOCK);
  if (!match) return {};
  const fields: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return fields;
}

/**
 * Split a document into its frontmatter fields and the content below them
 * (FR-CHAT-15).
 *
 * A file with no frontmatter comes back whole and unmodified, which includes
 * the case that reads like frontmatter and is not: a document opening with a
 * horizontal rule has a `---` line and no closing one, and its author meant it
 * to be seen.
 */
export function splitFrontmatter(content: string): {
  fields: Record<string, string>;
  body: string;
} {
  const match = content.match(FRONTMATTER_BLOCK);
  if (!match) return { fields: {}, body: content };
  return {
    fields: parseFrontmatter(content),
    // `\r?\n+` would consume one CRLF and then only bare newlines, leaving a
    // stray `\r` at the head of a CRLF document. The group has to repeat.
    body: content.slice(match[0].length).replace(/^(?:\r?\n)+/, ""),
  };
}
