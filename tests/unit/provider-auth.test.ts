// tests/unit/provider-auth.test.ts — FR-SETUP-04 key validation + storage.

import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { configureProviderKey } from "../../backends/provider-auth";

const tmpDirs: string[] = [];

function tempAuthPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "ab-auth-unit-"));
  tmpDirs.push(dir);
  return join(dir, "auth.json");
}

afterEach(() => {
  while (tmpDirs.length > 0) rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

const accept = async () => ({ ok: true });
const reject = async () => ({ ok: false, error: "HTTP 401" });

describe("configureProviderKey", () => {
  it("stores an accepted key as a pi ApiKeyCredential with 0600 perms", async () => {
    const authPath = tempAuthPath();
    const result = await configureProviderKey("anthropic", "sk-test", {
      authPath,
      probe: accept,
    });
    expect(result).toEqual({ valid: true });
    expect(JSON.parse(readFileSync(authPath, "utf8"))).toEqual({
      anthropic: { type: "api_key", key: "sk-test" },
    });
    expect(statSync(authPath).mode & 0o777).toBe(0o600);
  });

  it("merges with existing entries instead of overwriting the store", async () => {
    const authPath = tempAuthPath();
    writeFileSync(authPath, JSON.stringify({ google: { type: "api_key", key: "g" } }));
    await configureProviderKey("openai", "sk-o", { authPath, probe: accept });
    expect(JSON.parse(readFileSync(authPath, "utf8"))).toEqual({
      google: { type: "api_key", key: "g" },
      openai: { type: "api_key", key: "sk-o" },
    });
  });

  it("does not store anything when the probe rejects the key", async () => {
    const authPath = tempAuthPath();
    const result = await configureProviderKey("anthropic", "bad", {
      authPath,
      probe: reject,
    });
    expect(result).toEqual({ valid: false, error: "HTTP 401" });
    expect(() => readFileSync(authPath, "utf8")).toThrow();
  });

  it("requires a base URL for the custom provider before probing", async () => {
    const authPath = tempAuthPath();
    let probed = false;
    const result = await configureProviderKey("custom", "k", {
      authPath,
      probe: async () => {
        probed = true;
        return { ok: true };
      },
    });
    expect(result.valid).toBe(false);
    expect(probed).toBe(false);
  });
});
