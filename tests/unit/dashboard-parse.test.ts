// tests/unit/dashboard-parse.test.ts — FR-DASH-01

import { describe, expect, it } from "vitest";

import { parseDashboardDocument, parseDashboardParts } from "../../shared/dashboard/parse";

describe("parseDashboardParts", () => {
  it("splits prose and dashboard fences in order", () => {
    const body = `Intro.

\`\`\`dashboard
- view: text
  text: A
\`\`\`

Outro.`;
    const parts = parseDashboardParts(body);
    expect(parts).toHaveLength(3);
    expect(parts[0]).toEqual({ kind: "text", markdown: "Intro." });
    expect(parts[1].kind).toBe("dashboard_block");
    expect(parts[2]).toEqual({ kind: "text", markdown: "Outro." });
  });

  it("reports unclosed dashboard fence", () => {
    const body = `\`\`\`dashboard
- view: text
  text: x
`;
    const parts = parseDashboardParts(body);
    expect(parts).toHaveLength(1);
    expect(parts[0].kind).toBe("dashboard_block");
    if (parts[0].kind === "dashboard_block") {
      expect(parts[0].fenceError).toMatch(/fence/i);
    }
  });
});

describe("parseDashboardDocument", () => {
  it("reads type dashboard frontmatter fields", () => {
    const doc = parseDashboardDocument(`---
type: dashboard
title: My board
summary: Short
---

Body`);
    expect(doc.title).toBe("My board");
    expect(doc.summary).toBe("Short");
    expect(doc.body).toBe("Body");
  });
});
