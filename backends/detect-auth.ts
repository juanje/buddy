// backends/detect-auth.ts — Detect existing Pi credentials (temporary bypass).
// If the user already authenticated via `pi login`, we can skip the provider
// and model steps in the wizard. This is a bridge until OAuth is implemented
// natively in the app.

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

const PROVIDER_PRIORITY: Array<SetupConfig["provider"]> = [
  "anthropic",
  "openai",
  "google",
];

const DEFAULT_MODELS: Record<SetupConfig["provider"], string> = {
  anthropic: "claude-sonnet-4-5",
  openai: "gpt-4.1-mini",
  google: "gemini-2.5-flash",
  custom: "gpt-4.1-mini",
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

export function detectExistingAuth(
  authPath?: string,
): DetectedAuth | null {
  const path = authPath ?? join(homedir(), ".pi", "agent", "auth.json");
  if (!existsSync(path)) return null;

  let store: Record<string, AuthEntry>;
  try {
    store = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }

  for (const provider of PROVIDER_PRIORITY) {
    if (hasValidCredentials(store[provider])) {
      return { provider, model: DEFAULT_MODELS[provider] };
    }
  }

  return null;
}
