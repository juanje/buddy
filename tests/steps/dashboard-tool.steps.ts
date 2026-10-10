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
import type { BuddyWorld } from "../support/world";

interface DashboardToolWorld extends BuddyWorld {
  buddyDir?: string;
  dashboardToolResult?: DashboardActionResult;
  originalBody?: string;
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
    writeFileSync(abs, content.trim() + "\n", "utf8");
    this.originalBody = bodyAfterFrontmatter(content.trim() + "\n");
  },
);

When(
  "dashboard action {string} is invoked for dashboard {string} with title {string}",
  function (this: DashboardToolWorld, action: string, dashName: string, title: string) {
    this.dashboardToolResult = executeDashboardAction(root.call(this), action, { name: dashName, title });
  },
);

Then("dashboard file {string} body is unchanged", function (this: DashboardToolWorld, fileName: string) {
  const text = readFileSync(join(root.call(this), "user/dashboards", fileName), "utf8");
  assert.equal(bodyAfterFrontmatter(text), this.originalBody);
});

function bodyAfterFrontmatter(text: string): string {
  const m = /^---\r?\n[\s\S]*?\r?\n---/.exec(text);
  return m ? text.slice(m[0].length) : text;
}

Then("dashboard tool succeeded", function (this: DashboardToolWorld) {
  assert.ok(this.dashboardToolResult?.ok);
});

Then("dashboard tool failed", function (this: DashboardToolWorld) {
  assert.equal(this.dashboardToolResult?.ok, false);
});

Then("dashboard tool output mentions {string}", function (this: DashboardToolWorld, fragment: string) {
  assert.ok(this.dashboardToolResult?.text.includes(fragment), this.dashboardToolResult?.text);
});

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

