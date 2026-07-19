// backends/detect-auth.ts — Detect existing Pi credentials (temporary bypass).
// If the user already authenticated via `pi login`, we can skip the API key
// entry and offer a provider/model selection from what's already configured.

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { DetectedAuth, SetupConfig } from "../shared/api";

interface AuthEntry {
  type?: string;
  key?: string;
  access?: string;
  refresh?: string;
  expires?: number;
}

interface PiSettings {
  defaultProvider?: string;
  defaultModel?: string;
}

/** Maps Pi auth.json provider keys to our SetupConfig provider type. */
const PI_PROVIDER_MAP: Record<string, SetupConfig["provider"]> = {
  anthropic: "anthropic",
  openai: "openai",
  "openai-codex": "openai",
  google: "google",
};

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-sonnet-4-5",
  openai: "gpt-5.4-mini",
  "openai-codex": "gpt-5.4-mini",
  google: "gemini-2.5-flash",
};

function hasValidCredentials(entry: AuthEntry | undefined): boolean {
  if (!entry || typeof entry !== "object") return false;
  if (entry.type === "api_key" && entry.key) return true;
  if (entry.type === "oauth" && entry.access) {
    if (entry.expires && typeof entry.expires === "number") {
      return entry.expires > Date.now();
    }
    return true;
  }
  return false;
}

export interface DetectedAuthOption {
  piProvider: string;
  provider: SetupConfig["provider"];
  model: string;
  isDefault: boolean;
}

/**
 * Detect all valid Pi credentials. Returns the default (from Pi settings)
 * first, followed by any others. Returns null if none found.
 */
export function detectExistingAuth(
  authPath?: string,
  settingsPath?: string,
): DetectedAuth | null {
  const aPath = authPath ?? join(homedir(), ".pi", "agent", "auth.json");
  if (!existsSync(aPath)) return null;

  let store: Record<string, AuthEntry>;
  try {
    store = JSON.parse(readFileSync(aPath, "utf8"));
  } catch {
    return null;
  }

  let piSettings: PiSettings = {};
  const sPath = settingsPath ?? join(homedir(), ".pi", "agent", "settings.json");
  try {
    if (existsSync(sPath)) {
      piSettings = JSON.parse(readFileSync(sPath, "utf8"));
    }
  } catch {
    // No settings — use first valid provider
  }

  // Find all valid providers
  const options: DetectedAuthOption[] = [];
  for (const [piKey, entry] of Object.entries(store)) {
    if (!hasValidCredentials(entry)) continue;
    const mapped = PI_PROVIDER_MAP[piKey];
    if (!mapped) continue;
    options.push({
      piProvider: piKey,
      provider: mapped,
      model: DEFAULT_MODELS[piKey] ?? "gpt-5.4-mini",
      isDefault: piKey === piSettings.defaultProvider,
    });
  }

  if (options.length === 0) return null;

  // Prefer Pi's default provider; fall back to first valid
  const defaultOption = options.find((o) => o.isDefault) ?? options[0];

  // If Pi settings has a model, use that
  const model = defaultOption.isDefault && piSettings.defaultModel
    ? piSettings.defaultModel
    : defaultOption.model;

  return {
    provider: defaultOption.provider,
    model,
    options: options.map((o) => ({ piProvider: o.piProvider, provider: o.provider, model: o.model })),
  };
}
