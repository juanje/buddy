// backends/location.ts — Buddy location validation (FR-SETUP-03, FR-SETUP-08
// detection). A candidate path is usable when it does not exist yet or is an
// empty directory; a directory with agent_brain/ is an existing buddy instance
// offered for import.

import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { LocationCheck } from "../shared/api";
import { readPiSettings } from "../shared/pi-settings";

/** Proposed default buddy location (FR-SETUP-03). */
export function defaultBuddyLocation(): string {
  return join(homedir(), "buddy");
}

export function validateLocation(path: string): LocationCheck {
  let stat;
  try {
    stat = statSync(path);
  } catch {
    return { status: "ok-new" }; // does not exist — setup will create it
  }

  if (!stat.isDirectory()) {
    return { status: "not-a-directory" };
  }

  const entries = readdirSync(path);
  if (entries.length === 0) {
    return { status: "ok-empty" };
  }

  try {
    if (statSync(join(path, "agent_brain")).isDirectory()) {
      // FR-SETUP-12: `agent_brain/` alone does not make a usable instance.
      const missing = missingInstanceParts(path);
      if (missing.length > 0) {
        return { status: "incomplete-buddy", missing };
      }
      // FR-SETUP-08: offer import; surface the instance's own Pi settings so
      // the wizard can skip provider/model when they are already known.
      return { status: "existing-buddy", buddySettings: readBuddySettings(path) };
    }
  } catch {
    // no agent_brain/ — fall through
  }

  return { status: "not-empty" };
}

/**
 * What an instance is missing that cannot be repaired (FR-SETUP-12).
 *
 * The line is between *unusable* and *incomplete but fixable*, not between
 * "matches the template" and "does not":
 *
 * - **Refused:** no identity at all. `agent_brain/` with neither SOUL.md nor
 *   USER.md is the shape `createBuddyInstance` leaves behind when it fails
 *   partway — templates half-copied, `markConfigured` never reached. Adopting
 *   that wreckage produced a permanently broken install.
 * - **Repaired on adopt:** a missing git repository and missing `.gitignore`
 *   rules. Both are created without touching content, and a hand-made instance
 *   (the upstream template, a directory carried between machines) legitimately
 *   arrives without them.
 *
 * Requiring the full template would refuse instances that work perfectly well.
 */
export function missingInstanceParts(path: string): string[] {
  const identityFiles = ["agent_brain/identity/SOUL.md", "agent_brain/identity/USER.md"];
  const hasIdentity = identityFiles.some((relPath) => existsSync(join(path, relPath)));
  return hasIdentity ? [] : ["an identity (SOUL.md or USER.md)"];
}

function readBuddySettings(abPath: string): LocationCheck["buddySettings"] {
  const raw = readPiSettings(abPath);
  if (!raw) return undefined;
  return { provider: raw.defaultProvider, model: raw.defaultModel };
}

/**
 * Refuse a setup whose target location is not valid for the requested mode
 * (FR-SETUP-11).
 *
 * Throws a message written for the user, not for a log: it reaches them through
 * the wizard's failure path.
 */
export function assertSetupLocationAllowed(
  rootDir: string,
  mode: "create" | "import",
): void {
  const check = validateLocation(rootDir);

  if (mode === "import") {
    if (check.status === "existing-buddy") return;
    if (check.status === "incomplete-buddy") {
      throw new Error(
        `That folder holds an unfinished assistant and cannot be imported. ` +
          `Missing: ${(check.missing ?? []).join(", ")}. Choose an empty folder instead.`,
      );
    }
    throw new Error("That folder does not contain an assistant to import.");
  }

  if (check.status === "ok-new" || check.status === "ok-empty") return;
  if (check.status === "not-a-directory") {
    throw new Error("That path is not a folder.");
  }
  throw new Error(
    "That folder already has files in it. Choose an empty folder or one that does not exist yet.",
  );
}
