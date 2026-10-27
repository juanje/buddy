// tests/support/progress-demo.ts — a throwaway git project for NFR-TEST-03.
//
// The progress check reads real commits and runs real test runners at them, so
// the scenarios need a real project: a tiny one with its own vitest, cucumber,
// tsc and vite build, sharing buddy's node_modules through a symlink. The FR
// under check is FR-DEMO-01 (a greeting); FR-OTHER-01 (a farewell) is the
// "another FR" whose scenario can break the gate.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { GIT_USER_EMAIL, GIT_USER_NAME } from "../../shared/defaults";

const BUDDY_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");

/** One planned commit: files to write (null deletes) and its message. */
export interface PlannedCommit {
  message: string;
  files: Record<string, string | null>;
  /** Name under which the commit's sha is remembered. */
  role?: string;
}

const SKELETON: Record<string, string> = {
  ".gitignore": "node_modules\ndist\n",
  "package.json": `${JSON.stringify(
    {
      name: "demo",
      private: true,
      type: "module",
      scripts: {
        test: "npm run test:unit && npm run test:bdd",
        "test:unit": "vitest run",
        "test:bdd": "cucumber-js",
      },
    },
    null,
    2,
  )}\n`,
  "cucumber.mjs":
    'export default { paths: ["specs/features/**/*.feature"], import: ["tests/steps/**/*.js"] };\n',
  "vitest.config.js":
    'export default { test: { include: ["tests/unit/**/*.test.js"], passWithNoTests: true } };\n',
  "tsconfig.json": `${JSON.stringify({
    compilerOptions: {
      strict: true,
      noEmit: true,
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      skipLibCheck: true,
      types: [],
    },
    include: ["src/**/*.ts"],
  })}\n`,
  "index.html":
    '<!doctype html><html><body><script type="module" src="/src/version.ts"></script></body></html>\n',
  "src/version.ts": 'export const version: string = "1";\n',
  "src/greeting.js": "export function greet(_name) {\n  return \"\";\n}\n",
  "src/farewell.js": "export function farewell(name) {\n  return `Goodbye, ${name}`;\n}\n",
  "specs/features/farewell.feature": [
    "Feature: Farewell",
    "  @FR-OTHER-01",
    "  Scenario: A farewell is shown",
    '    When I say goodbye to "Ana"',
    '    Then I read "Goodbye, Ana"',
    "",
  ].join("\n"),
  "tests/steps/farewell.steps.js": [
    'import { When, Then } from "@cucumber/cucumber";',
    'import assert from "node:assert/strict";',
    'import { farewell } from "../../src/farewell.js";',
    "let said;",
    'When("I say goodbye to {string}", (name) => { said = farewell(name); });',
    'Then("I read {string}", (text) => assert.equal(said, text));',
    "",
  ].join("\n"),
};

export const GREETING_FEATURE = [
  "Feature: Greeting",
  "  @FR-DEMO-01",
  "  Scenario: A greeting is shown",
  '    When I greet "Ana"',
  '    Then I see "Hello, Ana"',
  "",
].join("\n");

export const GREETING_STEPS = [
  'import { When, Then } from "@cucumber/cucumber";',
  'import assert from "node:assert/strict";',
  'import { greet } from "../../src/greeting.js";',
  "let shown;",
  'When("I greet {string}", (name) => { shown = greet(name); });',
  'Then("I see {string}", (text) => assert.equal(shown, text));',
  "",
].join("\n");

export const GREETING_UNIT_TEST = [
  'import { expect, it } from "vitest";',
  'import { greet } from "../../src/greeting.js";',
  'it("greets by name", () => { expect(greet("Ana")).toBe("Hello, Ana"); });',
  "",
].join("\n");

/** Passes against the stub: it checks a type, not the behaviour. */
export const WEAK_UNIT_TEST = [
  'import { expect, it } from "vitest";',
  'import { greet } from "../../src/greeting.js";',
  'it("returns a string", () => { expect(typeof greet("Ana")).toBe("string"); });',
  "",
].join("\n");

/** Calls a function the module does not export yet: a TypeError while it runs. */
export const MISSING_FUNCTION_UNIT_TEST = [
  'import { expect, it } from "vitest";',
  'import * as greeting from "../../src/greeting.js";',
  'it("shouts", () => { expect(greeting.shout("ana")).toBe("ANA"); });',
  "",
].join("\n");

/** Imports a module that does not exist yet: the file fails to load. */
export const MISSING_MODULE_UNIT_TEST = [
  'import { expect, it } from "vitest";',
  'import { shout } from "../../src/shout.js";',
  'it("shouts", () => { expect(shout("ana")).toBe("ANA"); });',
  "",
].join("\n");

export const GREETING_CODE = [
  "export function greet(name) {",
  "  return `Hello, ${name}`;",
  "}",
  "export function shout(text) {",
  "  return text.toUpperCase();",
  "}",
  "",
].join("\n");

export const SHOUT_CODE = 'export { shout } from "./greeting.js";\n';

export class DemoProject {
  readonly root: string;
  /** Sha of each commit made with a role, by role. */
  readonly roles: Record<string, string> = {};

  constructor() {
    this.root = mkdtempSync(join(tmpdir(), "buddy-progress-demo-"));
    this.git("init", "-q", "-b", "main");
    this.git("config", "user.name", GIT_USER_NAME);
    this.git("config", "user.email", GIT_USER_EMAIL);
    this.git("config", "commit.gpgsign", "false");
    symlinkSync(join(BUDDY_ROOT, "node_modules"), join(this.root, "node_modules"));
    this.commit({ message: "chore(demo): project skeleton", files: SKELETON });
  }

  git(...args: string[]): string {
    return execFileSync("git", args, { cwd: this.root, encoding: "utf8" }).trim();
  }

  head(): string {
    return this.git("rev-parse", "HEAD");
  }

  write(files: Record<string, string | null>): void {
    for (const [path, content] of Object.entries(files)) {
      const full = join(this.root, path);
      if (content === null) {
        rmSync(full, { force: true });
        continue;
      }
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content, "utf8");
    }
  }

  commit(planned: PlannedCommit): string {
    this.write(planned.files);
    this.git("add", "-A");
    this.git("commit", "-q", "-m", planned.message);
    const sha = this.head();
    if (planned.role) this.roles[planned.role] = sha;
    return sha;
  }

  /** Discard every commit after `sha` and replay `plan` on top of it. */
  replay(sha: string, plan: PlannedCommit[]): void {
    this.git("reset", "-q", "--hard", sha);
    for (const planned of plan) this.commit(planned);
  }

  remove(): void {
    rmSync(this.root, { recursive: true, force: true });
  }
}
