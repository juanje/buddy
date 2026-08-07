// backends/brain-migration.ts — FR-BRAIN-08: scaffold missing sections in USER.md.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PREFERENCES_HEADING = "## Preferences";

const PREFERENCES_SCAFFOLD = `\n${PREFERENCES_HEADING}

How the user likes to work, communicate, and receive information. Keep current — update when preferences change, don't accumulate history here.
`;

function hasSection(content: string, heading: string): boolean {
  return new RegExp(`^${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "m").test(content);
}

/**
 * Ensure USER.md contains a `## Preferences` section.
 * Returns the (possibly modified) content. Pure function — caller decides
 * whether to write.
 */
export function ensureUserMdSections(content: string): string {
  if (hasSection(content, PREFERENCES_HEADING)) return content;
  return content.trimEnd() + "\n" + PREFERENCES_SCAFFOLD;
}

/**
 * Read USER.md from disk, scaffold missing sections, write back only if changed.
 * No-op when the section already exists.
 */
export function ensureUserMdSectionsOnDisk(rootDir: string): void {
  const userMdPath = join(rootDir, "agent_brain", "identity", "USER.md");
  if (!existsSync(userMdPath)) return;
  const original = readFileSync(userMdPath, "utf8");
  const updated = ensureUserMdSections(original);
  if (updated !== original) {
    writeFileSync(userMdPath, updated);
  }
}
