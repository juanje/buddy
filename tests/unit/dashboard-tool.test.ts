// tests/unit/dashboard-tool.test.ts — FR-DASH-12

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { executeDashboardAction } from "../../backends/dashboard/dashboard-tool-actions";

describe("dashboard tool", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("help lists built-in sources", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-tool-"));
    const out = executeDashboardAction(dir, "help");
    expect(out.ok).toBe(true);
    expect(out.text).toMatch(/tasks/);
    expect(out.text).toMatch(/projects/);
  });

  it("fields does not return rows", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-tool-"));
    const out = executeDashboardAction(dir, "fields", { source: "tasks" });
    expect(out.ok).toBe(true);
    expect(out.text).not.toMatch(/Next one/);
    expect(out.text).toMatch(/text:/);
  });

  it("check positive for sections-shaped file", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-tool-"));
    const path = join(dir, "user", "notes", "board.md");
    mkdirSync(join(dir, "user", "notes"), { recursive: true });
    writeFileSync(path, "## A\n- one\n", "utf8");
    const out = executeDashboardAction(dir, "check", { path: "user/notes/board.md" });
    expect(out.ok).toBe(true);
    expect(out.text).toMatch(/fits the sections primitive/i);
  });

  it("check negative offers derived path", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-tool-"));
    const path = join(dir, "user", "notes", "plain.md");
    mkdirSync(join(dir, "user", "notes"), { recursive: true });
    writeFileSync(path, "No structure\n", "utf8");
    const out = executeDashboardAction(dir, "check", { path: "user/notes/plain.md" });
    expect(out.ok).toBe(true);
    expect(out.text).toMatch(/user\/data\/plain-sections\.md/);
  });

  it("validate reports unknown field errors", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-tool-"));
    const content = `---
type: dashboard
---
\`\`\`dashboard
- view: table
  source: tasks
  columns: [not_a_field]
\`\`\``;
    const out = executeDashboardAction(dir, "validate", { content });
    expect(out.ok).toBe(false);
    expect(out.text).toMatch(/not_a_field/i);
  });

  it("create valid writes atomically", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-tool-"));
    const content = `---
type: dashboard
---
\`\`\`dashboard
- view: text
  text: Hi
\`\`\``;
    const out = executeDashboardAction(dir, "create", { name: "demo", content });
    expect(out.ok).toBe(true);
    expect(existsSync(join(dir, "user/dashboards/demo.md"))).toBe(true);
  });

  it("create invalid refuses to write", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-tool-"));
    const content = `---
type: dashboard
---
\`\`\`dashboard
- view: table
  source: tasks
  columns: [bad_field]
\`\`\``;
    const out = executeDashboardAction(dir, "create", { name: "bad", content });
    expect(out.ok).toBe(false);
    expect(existsSync(join(dir, "user/dashboards/bad.md"))).toBe(false);
  });

  it("update widget preserves free text", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-tool-"));
    const initial = `---
type: dashboard
---
Intro stays.

\`\`\`dashboard
- view: text
  title: Greeting
  text: Old
\`\`\``;
    executeDashboardAction(dir, "create", { name: "board", content: initial });
    const out = executeDashboardAction(dir, "update", {
      name: "board",
      widget_title: "Greeting",
      widget: { view: "text", title: "Greeting", text: "New" },
    });
    expect(out.ok).toBe(true);
    const saved = readFileSync(join(dir, "user/dashboards/board.md"), "utf8");
    expect(saved).toMatch(/Intro stays/);
    expect(saved).toMatch(/New/);
    expect(saved).not.toMatch(/Old/);
  });

  it("create with template mis-tareas", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-tool-"));
    const out = executeDashboardAction(dir, "create", { name: "tareas", template: "mis-tareas" });
    expect(out.ok).toBe(true);
    expect(existsSync(join(dir, "user/dashboards/tareas.md"))).toBe(true);
  });

  it("examples copies bundled dashboards", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-tool-"));
    const out = executeDashboardAction(dir, "examples");
    expect(out.ok).toBe(true);
    expect(existsSync(join(dir, "user/dashboards/examples/tablero-inline.md"))).toBe(true);
  });

  it("update title rewrites only the frontmatter line", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-tool-"));
    const initial = "---\ntype: dashboard\ntitle: Old\n---\n\nIntro.\n\n```dashboard\n- view: text\n  text:   Spaced\n```\n";
    executeDashboardAction(dir, "create", { name: "t", content: initial });
    const out = executeDashboardAction(dir, "update", { name: "t", title: "New", summary: "S" });
    expect(out.ok).toBe(true);
    const saved = readFileSync(join(dir, "user/dashboards/t.md"), "utf8");
    expect(saved).toBe("---\ntype: dashboard\ntitle: New\nsummary: S\n---\n\nIntro.\n\n```dashboard\n- view: text\n  text:   Spaced\n```\n");
  });

  it("update rejects a multi-line title", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-tool-"));
    executeDashboardAction(dir, "create", { name: "t", template: "mis-tareas" });
    const out = executeDashboardAction(dir, "update", { name: "t", title: "a\nb" });
    expect(out.ok).toBe(false);
  });

  it("update with nothing to change explains the three forms", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-tool-"));
    executeDashboardAction(dir, "create", { name: "t", template: "mis-tareas" });
    const out = executeDashboardAction(dir, "update", { name: "t" });
    expect(out.ok).toBe(false);
    expect(out.text).toMatch(/title\/summary/);
  });

  it("update ambiguous title fails", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-tool-"));
    const content = `---
type: dashboard
---
\`\`\`dashboard
- view: text
  title: Same
  text: A
- view: text
  title: Same
  text: B
\`\`\``;
    executeDashboardAction(dir, "create", { name: "dup", content });
    const out = executeDashboardAction(dir, "update", {
      name: "dup",
      widget_title: "Same",
      widget: { view: "text", title: "Same", text: "C" },
    });
    expect(out.ok).toBe(false);
    expect(out.text).toMatch(/Multiple widgets/i);
  });
});
