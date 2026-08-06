// tests/steps/write-guard.steps.ts — FR-GUARD-01 BDD steps.

import { Given, When, Then, After } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { createHeadingGuard, type HeadingGuard } from "../../backends/heading-guard";

interface WriteGuardWorld {
  tmpDir?: string;
  rootDir?: string;
  guard?: HeadingGuard;
  filePath?: string;
  relPath?: string;
  originalContent?: string;
  checkResult?: { reverted: boolean; lostHeadings?: string[] };
  toolFailed?: boolean;
}

After(function (this: WriteGuardWorld) {
  if (this.tmpDir) rmSync(this.tmpDir, { recursive: true, force: true });
});

function ensureDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

Given(
  "a brain file {string} with headings {string}",
  function (this: WriteGuardWorld, relPath: string, headingsCsv: string) {
    this.tmpDir = mkdtempSync(join(tmpdir(), "buddy-guard-"));
    this.rootDir = this.tmpDir;
    this.guard = createHeadingGuard(this.rootDir);
    this.relPath = relPath;
    this.filePath = join(this.rootDir, relPath);

    const headings = headingsCsv.split(", ");
    const body = headings.map((h) => `## ${h}\n\nContent under ${h}.\n`).join("\n");
    const content = `---\nsummary: test\n---\n\n${body}`;
    ensureDir(this.filePath);
    writeFileSync(this.filePath, content, "utf8");
    this.originalContent = content;
  },
);

Given(
  "a user file {string} with headings {string}",
  function (this: WriteGuardWorld, relPath: string, headingsCsv: string) {
    this.tmpDir = mkdtempSync(join(tmpdir(), "buddy-guard-"));
    this.rootDir = this.tmpDir;
    this.guard = createHeadingGuard(this.rootDir);
    this.relPath = relPath;
    this.filePath = join(this.rootDir, relPath);

    const headings = headingsCsv.split(", ");
    const body = headings.map((h) => `## ${h}\n\nContent under ${h}.\n`).join("\n");
    ensureDir(this.filePath);
    writeFileSync(this.filePath, body, "utf8");
    this.originalContent = body;
  },
);

Given(
  "a log file {string} with headings {string}",
  function (this: WriteGuardWorld, relPath: string, headingsCsv: string) {
    this.tmpDir = mkdtempSync(join(tmpdir(), "buddy-guard-"));
    this.rootDir = this.tmpDir;
    this.guard = createHeadingGuard(this.rootDir);
    this.relPath = relPath;
    this.filePath = join(this.rootDir, relPath);

    const headings = headingsCsv.split(", ");
    const body = headings.map((h) => `## ${h}\n\nLog content.\n`).join("\n");
    ensureDir(this.filePath);
    writeFileSync(this.filePath, body, "utf8");
    this.originalContent = body;
  },
);

Given(
  "a log file {string} with title {string} and headings {string}",
  function (this: WriteGuardWorld, relPath: string, title: string, headingsCsv: string) {
    this.tmpDir = mkdtempSync(join(tmpdir(), "buddy-guard-"));
    this.rootDir = this.tmpDir;
    this.guard = createHeadingGuard(this.rootDir);
    this.relPath = relPath;
    this.filePath = join(this.rootDir, relPath);

    const headings = headingsCsv.split(", ");
    const body = headings.map((h) => `## ${h}\n\nLog content.\n`).join("\n");
    const content = `---\ndate: 2026-08-05\nstatus: active\n---\n\n# ${title}\n\n${body}`;
    ensureDir(this.filePath);
    writeFileSync(this.filePath, content, "utf8");
    this.originalContent = content;
  },
);

Given(
  "a brain file {string} with frontmatter and headings {string}",
  function (this: WriteGuardWorld, relPath: string, headingsCsv: string) {
    this.tmpDir = mkdtempSync(join(tmpdir(), "buddy-guard-"));
    this.rootDir = this.tmpDir;
    this.guard = createHeadingGuard(this.rootDir);
    this.relPath = relPath;
    this.filePath = join(this.rootDir, relPath);

    const headings = headingsCsv.split(", ");
    const body = headings.map((h) => `## ${h}\n\nContent under ${h}.\n`).join("\n");
    const content = `---\nsummary: test file\nupdated: 2026-08-05\n---\n\n# ${headings[0]}\n\n${body}`;
    ensureDir(this.filePath);
    writeFileSync(this.filePath, content, "utf8");
    this.originalContent = content;
  },
);

When(
  "the agent writes the file without the title {string}",
  function (this: WriteGuardWorld, title: string) {
    this.guard!.capture(this.filePath!);
    const content = readFileSync(this.filePath!, "utf8");
    const newContent = content
      .split("\n")
      .filter((line) => line !== `# ${title}`)
      .join("\n");
    writeFileSync(this.filePath!, newContent, "utf8");
    this.checkResult = this.guard!.check(this.filePath!);
  },
);

When(
  "the agent writes the file without frontmatter",
  function (this: WriteGuardWorld) {
    this.guard!.capture(this.filePath!);
    const content = readFileSync(this.filePath!, "utf8");
    const fmEnd = content.indexOf("---", 3);
    const newContent = fmEnd >= 0 ? content.slice(fmEnd + 3).trimStart() : content;
    writeFileSync(this.filePath!, newContent, "utf8");
    this.checkResult = this.guard!.check(this.filePath!);
  },
);

When(
  "the agent writes the file keeping frontmatter and all headings",
  function (this: WriteGuardWorld) {
    this.guard!.capture(this.filePath!);
    const content = readFileSync(this.filePath!, "utf8");
    const newContent = content + "\n\nNew paragraph added.\n";
    writeFileSync(this.filePath!, newContent, "utf8");
    this.checkResult = this.guard!.check(this.filePath!);
  },
);

When(
  "the agent writes the file without the {string} heading",
  function (this: WriteGuardWorld, removedHeading: string) {
    this.guard!.capture(this.filePath!);
    const content = readFileSync(this.filePath!, "utf8");
    const newContent = content
      .split("\n")
      .filter((line) => !line.startsWith(`## ${removedHeading}`))
      .join("\n");
    writeFileSync(this.filePath!, newContent, "utf8");
    this.checkResult = this.guard!.check(this.filePath!);
  },
);

When(
  "the agent writes the file keeping all headings",
  function (this: WriteGuardWorld) {
    this.guard!.capture(this.filePath!);
    const content = readFileSync(this.filePath!, "utf8");
    const newContent = content + "\n\nNew paragraph added.\n";
    writeFileSync(this.filePath!, newContent, "utf8");
    this.checkResult = this.guard!.check(this.filePath!);
  },
);

When(
  "the agent edits the file replacing {string} with unrelated content",
  function (this: WriteGuardWorld, heading: string) {
    this.guard!.capture(this.filePath!);
    const content = readFileSync(this.filePath!, "utf8");
    const newContent = content.replace(
      `## ${heading}`,
      "## Communication & Style",
    );
    writeFileSync(this.filePath!, newContent, "utf8");
    this.checkResult = this.guard!.check(this.filePath!);
  },
);

When(
  "the agent writes the file adding a {string} heading",
  function (this: WriteGuardWorld, newHeading: string) {
    this.guard!.capture(this.filePath!);
    const content = readFileSync(this.filePath!, "utf8");
    const newContent = content + `\n## ${newHeading}\n\nNew section.\n`;
    writeFileSync(this.filePath!, newContent, "utf8");
    this.checkResult = this.guard!.check(this.filePath!);
  },
);

When(
  "the agent edit fails with an error",
  function (this: WriteGuardWorld) {
    this.guard!.capture(this.filePath!);
    this.toolFailed = true;
    // No file change — the edit tool failed.
  },
);

When(
  "the maintenance session writes the file without the {string} heading",
  function (this: WriteGuardWorld, removedHeading: string) {
    // Same guard, same behavior — the point is it's installable on both.
    this.guard!.capture(this.filePath!);
    const content = readFileSync(this.filePath!, "utf8");
    const newContent = content
      .split("\n")
      .filter((line) => !line.startsWith(`## ${removedHeading}`))
      .join("\n");
    writeFileSync(this.filePath!, newContent, "utf8");
    this.checkResult = this.guard!.check(this.filePath!);
  },
);

Then("the file is restored to its pre-write content", function (this: WriteGuardWorld) {
  assert.ok(this.checkResult?.reverted, "expected the file to be reverted");
  const current = readFileSync(this.filePath!, "utf8");
  assert.equal(current, this.originalContent);
});

Then("the tool result reports the lost heading {string}", function (this: WriteGuardWorld, heading: string) {
  assert.ok(this.checkResult?.lostHeadings?.includes(heading),
    `expected lost headings to include "${heading}", got: ${JSON.stringify(this.checkResult?.lostHeadings)}`);
});

Then("the file keeps the new content", function (this: WriteGuardWorld) {
  assert.ok(!this.checkResult?.reverted, "expected the file NOT to be reverted");
  const current = readFileSync(this.filePath!, "utf8");
  assert.notEqual(current, this.originalContent);
});

Then("the file is unchanged", function (this: WriteGuardWorld) {
  const current = readFileSync(this.filePath!, "utf8");
  assert.equal(current, this.originalContent);
});

Then("no heading check runs", function (this: WriteGuardWorld) {
  assert.ok(this.toolFailed, "the tool should have failed");
  assert.equal(this.checkResult, undefined, "check should not have been called");
});
