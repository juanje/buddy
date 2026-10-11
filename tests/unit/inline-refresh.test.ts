// tests/unit/inline-refresh.test.ts — FR-DASH-16

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { findStaleRefreshWidgets } from "../../shared/dashboard/inline-refresh";
import { validateViewParams } from "../../shared/dashboard/view-params";
import type { WidgetSpec } from "../../shared/dashboard/types";

describe("inline refresh", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("rejects refresh on non-inline source", () => {
    const spec: WidgetSpec = {
      view: "counter",
      source: "tasks",
      width: "full",
      raw: { view: "counter", source: "tasks", refresh: "daily", count: true },
    };
    expect(validateViewParams(spec, undefined)).toMatch(/refresh/i);
  });

  it("finds stale daily widget at depth 1", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-refresh-"));
    const body = [
      "---",
      "type: dashboard",
      "title: T",
      "summary: S",
      "---",
      "",
      "```dashboard",
      "- view: counter",
      "  title: Status",
      "  source: inline",
      "  updated: 2026-10-10",
      "  basis: Test",
      "  refresh: daily",
      "  count: true",
      "  rows:",
      "    - id: 1",
      "```",
    ].join("\n");
    mkdirSync(join(dir, "user/dashboards"), { recursive: true });
    writeFileSync(join(dir, "user/dashboards/board.md"), body);
    const stale = findStaleRefreshWidgets(dir, "2026-10-11", 1);
    expect(stale.some((w) => w.dashboardPath.endsWith("board.md"))).toBe(true);
  });
});
