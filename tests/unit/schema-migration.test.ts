// tests/unit/schema-migration.test.ts — NFR-MIGRATE schema versioning.

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { APP_SCHEMA_VERSION } from "../../shared/defaults";
import { ensureSchema, readSchemaVersion } from "../../backends/schema-migration";

describe("schema migration", () => {
  let configDir: string;

  afterEach(() => {
    if (configDir) rmSync(configDir, { recursive: true, force: true });
  });

  it("reads version 0 when version file is missing", () => {
    configDir = mkdtempSync(join(tmpdir(), "ab-schema-"));
    expect(readSchemaVersion(configDir)).toBe(0);
  });

  it("runs migrate_0_to_1 and writes version file", () => {
    configDir = mkdtempSync(join(tmpdir(), "ab-schema-"));
    ensureSchema(configDir);

    expect(readSchemaVersion(configDir)).toBe(APP_SCHEMA_VERSION);
    expect(existsSync(join(configDir, "prompts", "agents-base.md"))).toBe(true);
    expect(existsSync(join(configDir, "prompts", "consolidation.md"))).toBe(true);
    expect(existsSync(join(configDir, "prompts", "process-conversation.md"))).toBe(true);

    const agentsBase = readFileSync(join(configDir, "prompts", "agents-base.md"), "utf8");
    expect(agentsBase).toContain("# Your environment");
    expect(agentsBase).toContain("Never ask the user to commit");
  });

  it("is idempotent when schema is already current", () => {
    configDir = mkdtempSync(join(tmpdir(), "ab-schema-"));
    ensureSchema(configDir);
    const firstAgentsBase = readFileSync(join(configDir, "prompts", "agents-base.md"), "utf8");

    ensureSchema(configDir);

    expect(readSchemaVersion(configDir)).toBe(APP_SCHEMA_VERSION);
    expect(readFileSync(join(configDir, "prompts", "agents-base.md"), "utf8")).toBe(firstAgentsBase);
  });
});
