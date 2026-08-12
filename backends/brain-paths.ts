// backends/brain-paths.ts — absolute paths inside a buddy directory.
//
// The only place a rootDir is joined to a brain location. Callers ask for what
// they want ("the user profile") instead of assembling where it lives, so a
// misspelling is a compile error rather than a readIfExists that quietly
// returns undefined.
//
// Uses node:path.join, not string concatenation, so a rootDir with a trailing
// separator normalizes the same way it always has.
//
// Containment lives in ./containment.ts, not here (NFR-SEC-16). This module
// builds paths; it never decides whether one is allowed.

import { join } from "node:path";

import {
  BRAIN,
  BRAIN_DIR,
  BRAIN_SUBDIRS,
  DOWNLOADS_DIR,
  LOGS_ARCHIVE_DIR,
  LOGS_DIR,
  LOGS_INDEX,
  USER_DIR,
  WIKI_DIR,
  WIKI_GLOSSARY,
  WIKI_INDEX,
  WIKI_META_DIR,
  WIKI_META_LOG,
  dailyLogRelPath,
} from "../shared/brain-paths";

/** Join a buddy-root-relative path onto a root. */
export function buddyPath(rootDir: string, relPath: string): string {
  return join(rootDir, relPath);
}

export const soulPath = (rootDir: string): string => buddyPath(rootDir, BRAIN.soul);
export const userProfilePath = (rootDir: string): string => buddyPath(rootDir, BRAIN.user);
export const deferredPath = (rootDir: string): string => buddyPath(rootDir, BRAIN.deferred);
export const observationsPath = (rootDir: string): string => buddyPath(rootDir, BRAIN.observations);
export const brainIndexPath = (rootDir: string): string => buddyPath(rootDir, BRAIN.index);

export const brainDirPath = (rootDir: string): string => buddyPath(rootDir, BRAIN_DIR);
export const identityDirPath = (rootDir: string): string => buddyPath(rootDir, BRAIN_SUBDIRS.identity);
export const userDirPath = (rootDir: string): string => buddyPath(rootDir, USER_DIR);
export const downloadsDirPath = (rootDir: string): string => buddyPath(rootDir, DOWNLOADS_DIR);

export const logsDirPath = (rootDir: string): string => buddyPath(rootDir, LOGS_DIR);
export const logsIndexPath = (rootDir: string): string => buddyPath(rootDir, LOGS_INDEX);
export const logsArchiveDirPath = (rootDir: string): string =>
  buddyPath(rootDir, LOGS_ARCHIVE_DIR);
export const dailyLogPath = (rootDir: string, isoDay: string): string =>
  buddyPath(rootDir, dailyLogRelPath(isoDay));

export const wikiDirPath = (rootDir: string): string => buddyPath(rootDir, WIKI_DIR);
export const wikiIndexPath = (rootDir: string): string => buddyPath(rootDir, WIKI_INDEX);
export const wikiGlossaryPath = (rootDir: string): string => buddyPath(rootDir, WIKI_GLOSSARY);
export const wikiMetaDirPath = (rootDir: string): string => buddyPath(rootDir, WIKI_META_DIR);
export const wikiMetaLogPath = (rootDir: string): string => buddyPath(rootDir, WIKI_META_LOG);
