// backends/location.ts — AB location validation (FR-SETUP-03, FR-SETUP-08
// detection). A candidate path is usable when it does not exist yet or is an
// empty directory; a directory with agent_brain/ is an existing AB instance
// offered for import.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { LocationCheck } from "../shared/api";

/** Proposed default AB location (FR-SETUP-03). */
export function defaultAbLocation(): string {
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
      // FR-SETUP-08: offer import; surface the instance's own Pi settings so
      // the wizard can skip provider/model when they are already known.
      return { status: "existing-ab", abSettings: readAbSettings(path) };
    }
  } catch {
    // no agent_brain/ — fall through
  }

  return { status: "not-empty" };
}

function readAbSettings(abPath: string): LocationCheck["abSettings"] {
  try {
    const raw = JSON.parse(readFileSync(join(abPath, ".pi", "settings.json"), "utf8")) as {
      defaultProvider?: string;
      defaultModel?: string;
    };
    return { provider: raw.defaultProvider, model: raw.defaultModel };
  } catch {
    return undefined;
  }
}
