import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PREFERENCES_HEADING = "## Preferences";
const PRINCIPLES_HEADING = "## Principles";

const PREFERENCES_SCAFFOLD = `\n${PREFERENCES_HEADING}

How the user likes to work, communicate, and receive information. Keep current — update when preferences change, don't accumulate history here.
`;

const PRINCIPLES_SCAFFOLD = `\n${PRINCIPLES_HEADING}

Cross-domain patterns that explain multiple preferences or behaviors. Only add principles with strong evidence from several data points.
`;

function hasSection(content: string, heading: string): boolean {
  return new RegExp(`^${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "m").test(content);
}

export function ensureUserMdSections(content: string): string {
  let result = content;
  if (!hasSection(result, PREFERENCES_HEADING)) {
    result = result.trimEnd() + "\n" + PREFERENCES_SCAFFOLD;
  }
  if (!hasSection(result, PRINCIPLES_HEADING)) {
    result = result.trimEnd() + "\n" + PRINCIPLES_SCAFFOLD;
  }
  return result;
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
