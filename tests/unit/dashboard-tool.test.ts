// tests/unit/dashboard-tool.test.ts — FR-DASH-12

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { stringify } from "yaml";

import { executeDashboardAction } from "../../backends/dashboard/dashboard-tool-actions";
import { parseDashboardParts } from "../../shared/dashboard/parse";

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---(\r?\n)?/;

function replaceDashboardBlockYaml(content: string, blockNum: number, yaml: string): string {
  const fm = FRONTMATTER_RE.exec(content);
  const prefix = fm ? fm[0] : "";
  const body = content.slice(prefix.length);
  const part = parseDashboardParts(body).find(
    (p) => p.kind === "dashboard_block" && p.block === blockNum,
  );
  if (!part || part.kind !== "dashboard_block") throw new Error(`block ${blockNum} missing`);
  const lines = body.split(/\r?\n/);
  const yamlLines = yaml.length > 0 ? yaml.split(/\r?\n/) : [];
  return (
    prefix +
    [...lines.slice(0, part.yamlStartLine - 1), ...yamlLines, ...lines.slice(part.yamlEndLine)].join(
      "\n",
    )
  );
}

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

  it("validate cites block and widget position", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-tool-"));
    const content = `---
type: dashboard
---
\`\`\`dashboard
- view: text
  text: OK
\`\`\`

Between blocks.

\`\`\`dashboard
- view: text
  text: A
- view: table
  source: tasks
  columns: [bad_field]
\`\`\``;
    const out = executeDashboardAction(dir, "validate", { content });
    expect(out.ok).toBe(false);
    expect(out.text).toMatch(/block 2, widget 2/);
  });

  it("validate reports a schema error once", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-tool-"));
    const content = `---
type: dashboard
---
\`\`\`dashboard
- view: text
  text: OK
\`\`\`

Some prose.

\`\`\`dashboard
- view: nope
\`\`\``;
    const out = executeDashboardAction(dir, "validate", { content });
    expect(out.ok).toBe(false);
    expect(out.text.split("Unknown view 'nope'").length - 1).toBe(1);
    expect(out.text).toMatch(/block 2, widget 1/);
  });

  it("update replaces yaml only in the affected block", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-tool-"));
    const initial = `---
type: dashboard
---
Free line stays.

\`\`\`dashboard
- view: text
  title: Keep spacing
  text: |
      indented
# yaml comment stays
\`\`\`

\`\`\`dashboard
- view: text
  title: Target
  text: Old
\`\`\`
`;
    executeDashboardAction(dir, "create", { name: "surgical", content: initial });
    const before = readFileSync(join(dir, "user/dashboards/surgical.md"), "utf8");
    const out = executeDashboardAction(dir, "update", {
      name: "surgical",
      widget_title: "Target",
      widget: { view: "text", title: "Target", text: "New" },
    });
    expect(out.ok).toBe(true);
    const after = readFileSync(join(dir, "user/dashboards/surgical.md"), "utf8");
    const newYaml = stringify([{ view: "text", title: "Target", text: "New" }]).trim();
    const expected = replaceDashboardBlockYaml(before, 2, newYaml);
    expect(after).toBe(expected);
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

  it("bundled docs index links to dashboards.md", () => {
    const indexPath = join(
      fileURLToPath(import.meta.url),
      "..",
      "..",
      "..",
      "bundled",
      "docs",
      "index.md",
    );
    expect(readFileSync(indexPath, "utf8")).toContain("dashboards.md");
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

  it("update title and summary rewrite only those frontmatter lines", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-tool-"));
    const initial =
      "---\ntype: dashboard\ntitle: Old\n---\n\nIntro.\n\n```dashboard\n- view: text\n  text:   Spaced\n```\n";
    executeDashboardAction(dir, "create", { name: "t", content: initial });
    const out = executeDashboardAction(dir, "update", { name: "t", title: "New", summary: "S" });
    expect(out.ok).toBe(true);
    expect(readFileSync(join(dir, "user/dashboards/t.md"), "utf8")).toBe(
      "---\ntype: dashboard\ntitle: New\nsummary: S\n---\n\nIntro.\n\n```dashboard\n- view: text\n  text:   Spaced\n```\n",
    );
  });

  it("update rejects a multi-line title", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-tool-"));
    executeDashboardAction(dir, "create", { name: "t", template: "mis-tareas" });
    const before = readFileSync(join(dir, "user/dashboards/t.md"), "utf8");
    const out = executeDashboardAction(dir, "update", { name: "t", title: "a\nb" });
    expect(out.ok).toBe(false);
    expect(readFileSync(join(dir, "user/dashboards/t.md"), "utf8")).toBe(before);
  });

  it("update with nothing to change lists the three forms", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-tool-"));
    executeDashboardAction(dir, "create", { name: "t", template: "mis-tareas" });
    const out = executeDashboardAction(dir, "update", { name: "t" });
    expect(out.ok).toBe(false);
    expect(out.text).toMatch(/title\/summary/);
    expect(out.text).toMatch(/widget_title/);
    expect(out.text).toMatch(/content/);
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

  it("fields for series returns types without row values", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-tool-"));
    const rel = "user/data/series-fields.csv";
    const abs = join(dir, rel);
    mkdirSync(join(dir, "user/data"), { recursive: true });
    writeFileSync(abs, "date,amount\n2026-10-01,5\n", "utf8");
    const out = executeDashboardAction(dir, "fields", { source: "series", path: rel });
    expect(out.ok).toBe(true);
    expect(out.text).toMatch(/date:/);
    expect(out.text).not.toMatch(/2026-10-01/);
  });

  it("check on csv points to series source", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-tool-"));
    const rel = "user/data/check.csv";
    const abs = join(dir, rel);
    mkdirSync(join(dir, "user/data"), { recursive: true });
    writeFileSync(abs, "x,y\n1,2\n", "utf8");
    const out = executeDashboardAction(dir, "check", { path: rel });
    expect(out.ok).toBe(true);
    expect(out.text).toMatch(/source: series/);
  });

  it("help explains file sources and field discovery", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-tool-"));
    const out = executeDashboardAction(dir, "help");
    expect(out.ok).toBe(true);
    expect(out.text).toMatch(/series/);
    expect(out.text).toMatch(/fields\(source/);
    expect(out.text).toMatch(/do not need to read the file/i);
  });

  it("unknown source error lists every source", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-tool-"));
    const out = executeDashboardAction(dir, "fields", { source: "csv" });
    expect(out.ok).toBe(false);
    expect(out.text).toMatch(/series/);
    expect(out.text).toMatch(/sections/);
    expect(out.text).toMatch(/inline/);
  });

  it("missing params error shows the params shape", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-tool-"));
    const out = executeDashboardAction(dir, "fields");
    expect(out.ok).toBe(false);
    expect(out.text).toMatch(/params=\{/);
  });

  it("bundled dashboards doc shows query and series examples", () => {
    const docPath = join(
      fileURLToPath(import.meta.url),
      "..",
      "..",
      "bundled",
      "docs",
      "dashboards.md",
    );
    const text = readFileSync(docPath, "utf8");
    expect(text).toContain("where: region = Europe");
    expect(text).toContain("where: date >= -30d");
    expect(text).toContain("sum:");
    expect(text).toContain("fields(source='series'");
  });

  it("check on a dashboard file points to validate", () => {
    dir = mkdtempSync(join(tmpdir(), "dash-tool-"));
    const rel = "user/dashboards/board.md";
    const abs = join(dir, rel);
    mkdirSync(join(dir, "user/dashboards"), { recursive: true });
    writeFileSync(
      abs,
      "---\ntype: dashboard\ntitle: Board\n---\n\n```dashboard\n- view: text\n  text: OK\n```\n",
      "utf8",
    );
    const out = executeDashboardAction(dir, "check", { path: rel });
    expect(out.ok).toBe(true);
    expect(out.text).toMatch(/validate/i);
    expect(out.text).not.toMatch(/user\/data\//);
  });
});
