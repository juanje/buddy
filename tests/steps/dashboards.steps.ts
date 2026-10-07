// tests/steps/dashboards.steps.ts — FR-DASH BDD steps.

import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";

import { resolveDashboardContent } from "../../backends/dashboard/resolve";
import type { ResolvedDashboard, ResolvedSegment } from "../../shared/dashboard/types";
import type { BuddyWorld } from "../support/world";

interface DashboardWorld extends BuddyWorld {
  buddyDir?: string;
  dashboardBody?: string;
  resolved?: ResolvedDashboard;
}

Given("a dashboard file with body:", function (this: DashboardWorld, body: string) {
  this.dashboardBody = [
    "---",
    "type: dashboard",
    "title: Test board",
    "summary: One line",
    "---",
    "",
    body.trim(),
  ].join("\n");
});

When("the dashboard is resolved for today {string}", function (this: DashboardWorld, today: string) {
  assert.ok(this.buddyDir && this.dashboardBody, "dashboard setup required");
  this.resolved = resolveDashboardContent(this.buddyDir, this.dashboardBody, today);
});

function segments(this: DashboardWorld): ResolvedSegment[] {
  assert.ok(this.resolved, "dashboard not resolved");
  return this.resolved.segments;
}

Then("the resolved dashboard has {int} segments", function (this: DashboardWorld, n: number) {
  assert.equal(segments.call(this).length, n);
});

Then("segment {int} is text {string}", function (this: DashboardWorld, index: number, text: string) {
  const seg = segments.call(this)[index - 1];
  assert.equal(seg.kind, "text");
  if (seg.kind === "text") {
    assert.equal(seg.markdown.trim(), text);
  }
});

Then(
  "segment {int} is a text widget with width {word}",
  function (this: DashboardWorld, index: number, width: string) {
    const seg = segments.call(this)[index - 1];
    assert.equal(seg.kind, "widget");
    if (seg.kind === "widget") {
      assert.equal(seg.spec.view, "text");
      assert.equal(seg.spec.width ?? "full", width);
      assert.notEqual(seg.result.kind, "error");
    }
  },
);

Then("segment {int} is a text widget without error", function (this: DashboardWorld, index: number) {
  const seg = segments.call(this)[index - 1];
  assert.equal(seg.kind, "widget");
  if (seg.kind === "widget") {
    assert.notEqual(seg.result.kind, "error");
  }
});

Then(
  "segment {int} widget result is an error mentioning {string}",
  function (this: DashboardWorld, index: number, fragment: string) {
    const seg = segments.call(this)[index - 1];
    assert.equal(seg.kind, "widget");
    if (seg.kind === "widget") {
      assert.equal(seg.result.kind, "error");
      if (seg.result.kind === "error") {
        assert.match(seg.result.message.toLowerCase(), new RegExp(fragment.toLowerCase()));
      }
    }
  },
);

Then("segment {int} widget result is an error", function (this: DashboardWorld, index: number) {
  const seg = segments.call(this)[index - 1];
  assert.equal(seg.kind, "widget");
  if (seg.kind === "widget") {
    assert.equal(seg.result.kind, "error");
  }
});
