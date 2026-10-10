// tests/steps/dashboard-tool.steps.ts — FR-DASH-12

import { DataTable, Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

import {
  executeDashboardAction,
  type DashboardActionResult,
} from "../../backends/dashboard/dashboard-tool-actions";
import { parseDashboardParts } from "../../shared/dashboard/parse";
import type { BuddyWorld } from "../support/world";

interface DashboardToolWorld extends BuddyWorld {
  buddyDir?: string;
  dashboardToolResult?: DashboardActionResult;
  originalBody?: string;
  originalContent?: string;
}

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---(\r?\n)?/;

function bodyAfterFrontmatter(text: string): string {
  const m = FRONTMATTER_RE.exec(text);
  return m ? text.slice(m[0].length) : text;
}

function dashboardBlockYaml(content: string, blockNum: number): string {
  const body = bodyAfterFrontmatter(content);
  const part = parseDashboardParts(body).find(
    (p) => p.kind === "dashboard_block" && p.block === blockNum,
  );
  assert.ok(part && part.kind === "dashboard_block", `dashboard block ${blockNum} not found`);
  return part.yaml;
}

function replaceDashboardBlockYaml(content: string, blockNum: number, yaml: string): string {
  const fm = FRONTMATTER_RE.exec(content);
  const prefix = fm ? fm[0] : "";
  const body = content.slice(prefix.length);
  const part = parseDashboardParts(body).find(
    (p) => p.kind === "dashboard_block" && p.block === blockNum,
  );
  assert.ok(part && part.kind === "dashboard_block", `dashboard block ${blockNum} not found`);
  const lines = body.split(/\r?\n/);
  const yamlLines = yaml.length > 0 ? yaml.split(/\r?\n/) : [];
  const newBody = [
    ...lines.slice(0, part.yamlStartLine - 1),
    ...yamlLines,
    ...lines.slice(part.yamlEndLine),
  ].join("\n");
  return prefix + newBody;
}

function root(this: DashboardToolWorld): string {
  assert.ok(this.buddyDir, "buddyDir required");
  return this.buddyDir;
}

When("dashboard action {string} is invoked", function (this: DashboardToolWorld, action: string) {
  this.dashboardToolResult = executeDashboardAction(root.call(this), action);
});

When(
  "dashboard action {string} is invoked with:",
  function (this: DashboardToolWorld, action: string, table: DataTable) {
    const params = table.rowsHash() as Record<string, string>;
    this.dashboardToolResult = executeDashboardAction(root.call(this), action, params);
  },
);

When(
  "dashboard action {string} is invoked with content:",
  function (this: DashboardToolWorld, action: string, content: string) {
    this.dashboardToolResult = executeDashboardAction(root.call(this), action, { content: content.trim() });
  },
);

When(
  "dashboard action {string} is invoked with name {string} and content:",
  function (this: DashboardToolWorld, action: string, name: string, content: string) {
    this.dashboardToolResult = executeDashboardAction(root.call(this), action, {
      name,
      content: content.trim(),
    });
  },
);

When(
  "dashboard action {string} is invoked with name {string} and template {string}",
  function (this: DashboardToolWorld, action: string, name: string, template: string) {
    this.dashboardToolResult = executeDashboardAction(root.call(this), action, { name, template });
  },
);

Given("the bundled docs index", function () {
  // no-op anchor for doc index scenario
});

Then("the bundled docs index links to dashboards.md", function () {
  const indexPath = join(
    fileURLToPath(import.meta.url),
    "..",
    "..",
    "..",
    "bundled",
    "docs",
    "index.md",
  );
  const text = readFileSync(indexPath, "utf8");
  assert.ok(text.includes("dashboards.md"));
});

When(
  "dashboard action {string} is invoked for dashboard {string} widget {string} with:",
  function (
    this: DashboardToolWorld,
    action: string,
    dashName: string,
    title: string,
    yamlBody: string,
  ) {
    const widget = parseYaml(yamlBody.trim()) as Record<string, unknown>;
    this.dashboardToolResult = executeDashboardAction(root.call(this), action, {
      name: dashName.replace(/\.md$/, ""),
      widget_title: title,
      widget,
    });
  },
);

Given(
  "dashboard file {string} with content:",
  function (this: DashboardToolWorld, fileName: string, content: string) {
    const rel = `user/dashboards/${fileName}`;
    const abs = join(root.call(this), rel);
    mkdirSync(join(root.call(this), "user", "dashboards"), { recursive: true });
    const saved = content.trim() + "\n";
    writeFileSync(abs, saved, "utf8");
    this.originalContent = saved;
    this.originalBody = bodyAfterFrontmatter(saved);
  },
);

When(
  "dashboard action {string} is invoked for dashboard {string} with title {string}",
  function (this: DashboardToolWorld, action: string, dashName: string, title: string) {
    this.dashboardToolResult = executeDashboardAction(root.call(this), action, {
      name: dashName,
      title,
    });
  },
);

When(
  "dashboard action {string} is invoked for dashboard {string} with no changes",
  function (this: DashboardToolWorld, action: string, dashName: string) {
    this.dashboardToolResult = executeDashboardAction(root.call(this), action, { name: dashName });
  },
);

Then("dashboard file {string} body is unchanged", function (this: DashboardToolWorld, fileName: string) {
  const text = readFileSync(join(root.call(this), "user/dashboards", fileName), "utf8");
  assert.equal(bodyAfterFrontmatter(text), this.originalBody);
});

Then(
  "dashboard file {string} outside dashboard block {int} is unchanged",
  function (this: DashboardToolWorld, fileName: string, blockNum: number) {
    assert.ok(this.originalContent, "originalContent required from Given dashboard file");
    const after = readFileSync(join(root.call(this), "user/dashboards", fileName), "utf8");
    const yamlBefore = dashboardBlockYaml(this.originalContent, blockNum);
    const normalized = replaceDashboardBlockYaml(after, blockNum, yamlBefore);
    assert.equal(normalized, this.originalContent);
  },
);

Then("dashboard tool succeeded", function (this: DashboardToolWorld) {
  assert.ok(this.dashboardToolResult?.ok);
});

Then("dashboard tool failed", function (this: DashboardToolWorld) {
  assert.equal(this.dashboardToolResult?.ok, false);
});

Then("dashboard tool output mentions {string}", function (this: DashboardToolWorld, fragment: string) {
  assert.ok(this.dashboardToolResult?.text.includes(fragment), this.dashboardToolResult?.text);
});

Then(
  "dashboard tool output mentions {string} once",
  function (this: DashboardToolWorld, fragment: string) {
    const text = this.dashboardToolResult?.text ?? "";
    const count = text.split(fragment).length - 1;
    assert.equal(count, 1, `expected "${fragment}" once in:\n${text}`);
  },
);

Then("dashboard tool output does not mention {string}", function (this: DashboardToolWorld, fragment: string) {
  assert.ok(!this.dashboardToolResult?.text.includes(fragment), this.dashboardToolResult?.text);
});

Then("dashboard file {string} exists", function (this: DashboardToolWorld, rel: string) {
  assert.ok(existsSync(join(root.call(this), rel)));
});

Then("dashboard file {string} does not exist", function (this: DashboardToolWorld, rel: string) {
  assert.ok(!existsSync(join(root.call(this), rel)));
});

Then(
  "dashboard file {string} contains {string}",
  function (this: DashboardToolWorld, fileName: string, fragment: string) {
    const text = readFileSync(join(root.call(this), "user/dashboards", fileName), "utf8");
    assert.ok(text.includes(fragment), text);
  },
);

Then(
  "dashboard file {string} does not contain {string}",
  function (this: DashboardToolWorld, fileName: string, fragment: string) {
    const text = readFileSync(join(root.call(this), "user/dashboards", fileName), "utf8");
    assert.ok(!text.includes(fragment), text);
  },
);

