// shared/brain-paths.ts — the layout of a buddy directory, in one place.
//
// Buddy-root-relative paths only, and no imports: this is browser-safe, because
// the frontend needs the same spellings for link shaping and the file viewer.
// Absolute paths are built by `backends/brain-paths.ts`, which joins these onto
// a rootDir with node:path.
//
// **Why this module exists.** Not renaming — nobody is going to rename
// `agent_brain`. It is that the layout was spelled out as string literals in
// seventeen files, and a typo in one fails *silently*: a mistyped
// `agent_brain/identiy/USER.md` makes `readIfExists` return undefined, the system
// prompt is assembled without the user's profile, and nothing errors, logs or
// fails a test. That is the failure shape this project keeps paying for; a named
// constant turns it into a compile error.
//
// **What this module is not.** It is not a containment authority. Whether a path
// is *inside* the brain — resolving `..`, following symlinks — belongs to
// `backends/containment.ts` and nowhere else (NFR-SEC-16, written after that
// rule was implemented four times and the fourth was wrong). These constants
// name locations; they do not judge paths. Testing a caller's string against
// `BRAIN.dir` proves nothing about where it points.

/** Directories directly under the buddy root. */
export const BRAIN_DIR = "agent_brain";
export const USER_DIR = "user";
export const LOGS_DIR = "logs";
export const DOWNLOADS_DIR = "downloads";

/** The index file every discoverable brain directory carries (NFR-FORMAT-01). */
export const INDEX_FILE = "index.md";

/** Sub-areas of `agent_brain/`. */
export const BRAIN_SUBDIRS = {
  identity: `${BRAIN_DIR}/identity`,
  concepts: `${BRAIN_DIR}/concepts`,
  projects: `${BRAIN_DIR}/projects`,
  ideas: `${BRAIN_DIR}/ideas`,
  skills: `${BRAIN_DIR}/skills`,
  archive: `${BRAIN_DIR}/archive`,
} as const;

/**
 * Named brain files, as buddy-root-relative paths.
 *
 * The canonical spellings. `shared/defaults.ts` derives its frontmatter and
 * core-file lists from these rather than restating the strings, so the two
 * cannot drift apart.
 */
export const BRAIN = {
  dir: BRAIN_DIR,
  soul: `${BRAIN_SUBDIRS.identity}/SOUL.md`,
  user: `${BRAIN_SUBDIRS.identity}/USER.md`,
  deferred: `${BRAIN_DIR}/deferred.md`,
  observations: `${BRAIN_DIR}/observations.md`,
  index: `${BRAIN_DIR}/${INDEX_FILE}`,
  scratchpad: `${BRAIN_SUBDIRS.ideas}/_scratchpad.md`,
} as const;

/** The logs index reflect and consolidation maintain (FR-REFLECT-04). */
export const LOGS_INDEX = `${LOGS_DIR}/${INDEX_FILE}`;
export const LOGS_ARCHIVE_DIR = `${LOGS_DIR}/archive`;

/** Relative path of the daily log for an ISO day (`logs/2026-07-29.md`). */
export function dailyLogRelPath(isoDay: string): string {
  return `${LOGS_DIR}/${isoDay}.md`;
}

/** Relative path of a directory's index (`agent_brain/concepts/index.md`). */
export function indexRelPath(dirRelPath: string): string {
  return `${dirRelPath}/${INDEX_FILE}`;
}

/**
 * Prefix form of a directory, for `startsWith` on a relative path.
 *
 * Spelling only. A `startsWith(dirPrefix(BRAIN_DIR))` test says what a string
 * looks like, not where it points — `agent_brain/../.pi/settings.json` passes
 * it. Callers that need to know whether a path is genuinely inside the brain
 * must resolve it through `backends/containment.ts` first and test the result,
 * which is what `consolidation-relocate.ts` does after NFR-SEC-16.
 */
export function dirPrefix(dirRelPath: string): string {
  return `${dirRelPath}/`;
}

export const BRAIN_PREFIX = dirPrefix(BRAIN_DIR);
/** Suffix identifying any directory index (`…/index.md`). */
export const INDEX_SUFFIX = `/${INDEX_FILE}`;

/** User wiki (FR-WIKI-01). Pages live under category subdirectories. */
export const WIKI_DIR = `${USER_DIR}/wiki`;
export const WIKI_META_DIR = `${WIKI_DIR}/.meta`;
export const WIKI_GLOSSARY = `${WIKI_DIR}/glossary.md`;
export const WIKI_INDEX = `${WIKI_DIR}/${INDEX_FILE}`;
export const WIKI_META_LOG = `${WIKI_META_DIR}/log.md`;
