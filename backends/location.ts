// backends/location.ts — AB location validation (FR-SETUP-03, FR-SETUP-08
// detection). A candidate path is usable when it does not exist yet or is an
// empty directory; a directory with agent_brain/ is an existing AB instance
// offered for import.

import { readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { LocationCheck } from "../shared/api";

/** Proposed default AB location (FR-SETUP-03). */
export function defaultAbLocation(): string {
  return join(homedir(), "my-ab");
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
      return { status: "existing-ab" }; // FR-SETUP-08: offer import
    }
  } catch {
    // no agent_brain/ — fall through
  }

  return { status: "not-empty" };
}
