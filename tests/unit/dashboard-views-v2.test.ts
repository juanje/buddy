// tests/unit/dashboard-views-v2.test.ts — FR-DASH-11

import { describe, expect, it } from "vitest";

import { executeDashboardAction } from "../../backends/dashboard/dashboard-tool-actions";
import { resolveDashboardContent } from "../../backends/dashboard/resolve";
import { buildDashboardViewModel } from "../../src/lib/dashboard/view-model";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function body(yaml: string): string {
  return `\`\`\`dashboard\n${yaml.trim()}\n\`\`\``;
}

function vmFor(yaml: string, today = "2026-10-11") {
  const dir = mkdtempSync(join(tmpdir(), "dash-v2-"));
  const resolved = resolveDashboardContent(dir, body(yaml), today);
  return buildDashboardViewModel(resolved, "en", "Empty");
}

function firstWidget(vm: ReturnType<typeof buildDashboardViewModel>) {
  for (const row of vm.rows) {
    if (row.kind === "widgetRow" && row.widgets[0]) return row.widgets[0];
  }
  throw new Error("no widget");
}

describe("FR-DASH-11 views v2", () => {
  it("bar with count and group produces one bar per group", () => {
    const w = firstWidget(
      vmFor(`
- view: bar
  source: inline
  updated: 2026-10-11
  basis: t
  group: region
  count: true
  rows:
    - region: A
    - region: A
    - region: B
`),
    );
    expect(w.kind).toBe("bar");
    if (w.kind === "bar") {
      expect(w.chart.bars.find((b) => b.label === "A")?.total).toBe(2);
      expect(w.chart.bars.find((b) => b.label === "B")?.total).toBe(1);
    }
  });

  it("bar with stack and threshold", () => {
    const w = firstWidget(
      vmFor(`
- view: bar
  source: inline
  updated: 2026-10-11
  basis: t
  group: area
  stack: kind
  sum: amount
  threshold: 10
  rows:
    - { area: work, kind: a, amount: 3 }
    - { area: work, kind: b, amount: 4 }
    - { area: home, kind: a, amount: 5 }
`),
    );
    expect(w.kind).toBe("bar");
    if (w.kind === "bar") {
      expect(w.chart.threshold).toBe(10);
      expect(w.chart.bars.find((b) => b.label === "work")?.total).toBe(7);
    }
  });

  it("bar without group is a widget error", () => {
    const resolved = resolveDashboardContent(
      mkdtempSync(join(tmpdir(), "dash-v2-")),
      body(`
- view: bar
  source: inline
  updated: 2026-10-11
  basis: t
  count: true
  rows:
    - region: A
`),
      "2026-10-11",
    );
    const seg = resolved.segments[0];
    expect(seg?.kind).toBe("widget");
    if (seg?.kind === "widget") expect(seg.result.kind).toBe("error");
  });

  it("line with two dates orders points by x", () => {
    const w = firstWidget(
      vmFor(`
- view: line
  source: inline
  updated: 2026-10-11
  basis: t
  x: date
  y: value
  rows:
    - { date: 2026-10-02, value: 2 }
    - { date: 2026-10-01, value: 1 }
`),
    );
    expect(w.kind).toBe("line");
    if (w.kind === "line") {
      expect(w.chart.points.map((p) => p.x)).toEqual(["2026-10-01", "2026-10-02"]);
    }
  });

  it("progress with sum and max", () => {
    const w = firstWidget(
      vmFor(`
- view: progress
  source: inline
  updated: 2026-10-11
  basis: t
  sum: amount
  max: 30
  rows:
    - { amount: 10 }
    - { amount: 5 }
`),
    );
    expect(w.kind).toBe("progress");
    if (w.kind === "progress") {
      expect(w.data?.value).toBe(15);
      expect(w.data?.max).toBe(30);
    }
  });

  it("progress until countdown days", () => {
    const w = firstWidget(
      vmFor(
        `
- view: progress
  until: 2026-10-20
`,
        "2026-10-11",
      ),
    );
    expect(w.kind).toBe("progress");
    if (w.kind === "progress") expect(w.countdown?.daysRemaining).toBe(9);
  });

  it("calendar sums value by day", () => {
    const w = firstWidget(
      vmFor(`
- view: calendar
  source: inline
  updated: 2026-10-11
  basis: t
  date: day
  value: amount
  rows:
    - { day: 2026-10-10, amount: 3 }
    - { day: 2026-10-10, amount: 4 }
`),
    );
    expect(w.kind).toBe("calendar");
    if (w.kind === "calendar") {
      expect(w.chart.cells.find((c) => c.date === "2026-10-10")?.value).toBe(7);
    }
  });

  it("timeline sorts by date and keeps labels", () => {
    const w = firstWidget(
      vmFor(`
- view: timeline
  source: inline
  updated: 2026-10-11
  basis: t
  date: when
  label: title
  rows:
    - { when: 2026-10-12, title: Later }
    - { when: 2026-10-09, title: First }
`),
    );
    expect(w.kind).toBe("timeline");
    if (w.kind === "timeline") {
      expect(w.chart.events.map((e) => e.label)).toEqual(["First", "Later"]);
    }
  });

  it("help mentions bar and threshold", () => {
    const dir = mkdtempSync(join(tmpdir(), "dash-tool-"));
    const out = executeDashboardAction(dir, "help");
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.text).toContain("bar");
      expect(out.text).toContain("threshold");
    }
  });
});
