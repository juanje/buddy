// src/lib/path-autolink.ts — buddy paths in assistant text become links
// (FR-CHAT-16).
//
// Buddy routinely names the file it touched — "Cambié tu perfil
// agent_brain/identity/USER.md". The target user has never opened a terminal
// and did not ask to learn the directory structure, so the path is noise
// mid-sentence unless it is something they can open.
//
// This works on marked's token tree rather than on rendered HTML, and that is
// the whole reason it is safe. A regex over the output would match the href
// inside an anchor the agent wrote and emit `<a>` inside `<a>`. Walking tokens
// means link subtrees can be skipped by identity, not by pattern.
//
// Presentational only. `resolveViewablePath` decides what may be linked, and
// the worker validates again before anything is read (NFR-SEC-08).

import type { Token as MarkedToken } from "marked";

import { BRAIN_DIR, LOGS_DIR } from "../../shared/brain-paths";
import { VIEWABLE_DIRS, VIEWABLE_EXTENSIONS } from "../../shared/defaults";
import { resolveViewablePath } from "../../shared/viewable-path";

/**
 * Directories whose contents are Buddy's own memory. A link into them shows
 * the file name alone: where Buddy keeps its notes is Buddy's business.
 * `user/` and `downloads/` are the user's space, and there the path is the
 * useful part — it is what lets them find the file in Obsidian or a file
 * manager.
 */
const AGENT_OWNED_DIRS: readonly string[] = [BRAIN_DIR, LOGS_DIR];

/**
 * Built from the same constants the containment check uses, so a new viewable
 * directory or extension cannot be recognised by one and missed by the other.
 *
 * The trailing `\b` after the extension is what keeps sentence punctuation out
 * of the path: "lo guardé en user/inbox.md." must link the file, not a name
 * ending in a period. Paths containing spaces are not matched — in prose there
 * is no way to tell where such a path ends.
 */
const PATH_PATTERN = new RegExp(
  `\\b(?:${VIEWABLE_DIRS.join("|")})\\/[\\w.\\-/]*\\.(?:${VIEWABLE_EXTENSIONS.map((ext) =>
    ext.slice(1),
  ).join("|")})\\b`,
  "g",
);

interface Token {
  type: string;
  raw?: string;
  text?: string;
  tokens?: Token[];
  items?: Token[];
  header?: Token[];
  rows?: Token[][];
  [key: string]: unknown;
}

function textToken(text: string): Token {
  return { type: "text", raw: text, text };
}

function linkToken(relPath: string, label: string): Token {
  return {
    type: "link",
    raw: label,
    href: relPath,
    // The full path stays one hover away even when the label is shorter, so
    // nothing is hidden — only moved out of the sentence.
    title: label === relPath ? null : relPath,
    text: label,
    tokens: [textToken(label)],
  };
}

/** The file name for Buddy's own directories, the whole path for the user's. */
export function autolinkLabel(relPath: string): string {
  const topDir = relPath.split("/")[0];
  if (!AGENT_OWNED_DIRS.includes(topDir)) return relPath;
  return relPath.slice(relPath.lastIndexOf("/") + 1);
}

/**
 * Split one text token into text and link tokens. Returns null when nothing in
 * it is a linkable path, so the original token is left untouched.
 */
function splitTextToken(token: Token): Token[] | null {
  const text = token.text ?? "";
  const out: Token[] = [];
  let cursor = 0;

  for (const match of text.matchAll(PATH_PATTERN)) {
    // The pattern recognises the shape; this decides whether it may be opened.
    // Traversals, paths outside the four directories and unviewable types are
    // all refused here, and stay plain text.
    const relPath = resolveViewablePath("", match[0]);
    if (!relPath) continue;
    const start = match.index ?? 0;
    if (start > cursor) out.push(textToken(text.slice(cursor, start)));
    out.push(linkToken(relPath, autolinkLabel(relPath)));
    cursor = start + match[0].length;
  }

  if (out.length === 0) return null;
  if (cursor < text.length) out.push(textToken(text.slice(cursor)));
  return out;
}

/**
 * Apply the zone label to a link the *agent* wrote, when its label says nothing
 * the path does not already say.
 *
 * Observed in dev: asked where a file lives, Buddy answers with
 * ``[`agent_brain/identity/USER.md`](agent_brain/identity/USER.md)`` — a link
 * whose label is a code span of its own target. Autolinking never reaches it,
 * since the path is already inside a link, so without this the case where Buddy
 * did the most work is the one showing the most internal structure.
 *
 * A label the agent actually chose ("mi perfil") is left alone: a description
 * beats any rule here.
 */
function relabelSelfDescribingLink(token: Token): void {
  const href = typeof token.href === "string" ? token.href : "";
  const relPath = resolveViewablePath("", href);
  if (!relPath) return;

  // The label as written, with code-span backticks removed — that form is the
  // one Buddy emits, and it describes the path no better than the path does.
  const label = (token.text ?? "").trim().replace(/^`+|`+$/g, "").trim();
  if (label !== relPath && label !== href.trim()) return;

  const zoneLabel = autolinkLabel(relPath);
  token.text = zoneLabel;
  token.tokens = [textToken(zoneLabel)];
  if (zoneLabel !== relPath) token.title = relPath;
}

/**
 * Rewrite a token tree in place, turning bare buddy paths into links.
 *
 * Two kinds of subtree are skipped, and each is a requirement rather than an
 * optimization:
 *
 *   `link` — a link the agent wrote already points somewhere. Descending would
 *            linkify its visible label: in
 *            `[agent_brain/foo.md](agent_brain/foo.md)` the label is a text
 *            token nested inside the link token.
 *   `code` — a fenced or indented block is content being shown, not a
 *            reference being made.
 *
 * A `codespan` is neither. Verified in dev: asked where a file lives, Buddy
 * answers `` `agent_brain/identity/USER.md` `` — backticks are how a model
 * writes a path in a sentence, so a span holding nothing else is the reference
 * itself. A span holding anything more (`cat user/inbox.md`) is a command being
 * quoted and stays as written.
 */
export function autolinkPathTokens(tokens: MarkedToken[]): void {
  // marked types its tokens as a closed union; this module treats them
  // structurally, so the cast is confined to this one boundary.
  walk(tokens as unknown as Token[]);
}

function walk(tokens: Token[]): void {
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.type === "link") {
      relabelSelfDescribingLink(token);
      continue;
    }
    if (token.type === "code") continue;

    if (token.type === "codespan") {
      const relPath = resolveViewablePath("", (token.text ?? "").trim());
      if (relPath && relPath === (token.text ?? "").trim()) {
        tokens.splice(i, 1, linkToken(relPath, autolinkLabel(relPath)));
      }
      continue;
    }

    if (token.type === "text" && !token.tokens) {
      const replacement = splitTextToken(token);
      if (replacement) {
        tokens.splice(i, 1, ...replacement);
        i += replacement.length - 1;
      }
      continue;
    }

    if (token.tokens) walk(token.tokens);
    if (token.items) walk(token.items);
    if (token.header) walk(token.header);
    if (token.rows) for (const row of token.rows) walk(row);
  }
}
