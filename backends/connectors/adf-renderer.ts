// backends/connectors/adf-renderer.ts — ADF → readable text (FR-JIRA-03).

export interface AdfNode {
  type: string;
  text?: string;
  content?: AdfNode[];
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

export function renderAdfToText(doc: unknown): string {
  if (!doc || typeof doc !== "object") return "";
  const node = doc as AdfNode;
  if (node.type === "doc" && Array.isArray(node.content)) {
    return node.content.map(renderBlock).join("\n\n").trim();
  }
  return renderBlock(node);
}

function renderBlock(node: AdfNode): string {
  switch (node.type) {
    case "paragraph":
      return renderInline(node.content);
    case "heading": {
      const level = Number(node.attrs?.level ?? 1);
      const prefix = "#".repeat(Math.min(Math.max(level, 1), 6));
      return `${prefix} ${renderInline(node.content)}`.trim();
    }
    case "bulletList":
      return (node.content ?? []).map((item) => `- ${renderListItem(item)}`).join("\n");
    case "orderedList":
      return (node.content ?? [])
        .map((item, index) => `${index + 1}. ${renderListItem(item)}`)
        .join("\n");
    case "listItem":
      return renderListItem(node);
    case "codeBlock": {
      const lang = node.attrs?.language ?? "";
      return `\`\`\`${lang}\n${renderInline(node.content)}\n\`\`\``.trim();
    }
    case "blockquote":
      return (node.content ?? []).map(renderBlock).join("\n").replace(/^/gm, "> ");
    case "table":
      return renderTable(node);
    case "rule":
      return "---";
    case "hardBreak":
      return "\n";
    case "text":
      return applyMarks(node.text ?? "", node.marks);
    default:
      if (node.content?.length) {
        return node.content.map(renderBlock).join("\n");
      }
      return `[unsupported:${node.type}]`;
  }
}

function renderListItem(node: AdfNode): string {
  const parts = (node.content ?? []).map((child) => {
    if (child.type === "paragraph") return renderInline(child.content);
    return renderBlock(child);
  });
  return parts.join(" ").trim();
}

function renderTable(node: AdfNode): string {
  const rows = (node.content ?? []).map((row) =>
    (row.content ?? []).map((cell) => renderBlock(cell).replace(/\n/g, " ")).join(" | "),
  );
  if (rows.length === 0) return "";
  const header = rows[0];
  const separator = header.split(" | ").map(() => "---").join(" | ");
  return [header, separator, ...rows.slice(1)].join("\n");
}

function renderInline(nodes: AdfNode[] | undefined): string {
  return (nodes ?? []).map(renderBlock).join("");
}

function applyMarks(text: string, marks: AdfNode["marks"]): string {
  if (!marks?.length) return text;
  let out = text;
  for (const mark of marks) {
    switch (mark.type) {
      case "strong":
        out = `**${out}**`;
        break;
      case "em":
        out = `*${out}*`;
        break;
      case "code":
        out = `\`${out}\``;
        break;
      case "strike":
        out = `~~${out}~~`;
        break;
      case "link": {
        const href = mark.attrs?.href;
        out = typeof href === "string" ? `[${out}](${href})` : out;
        break;
      }
      default:
        break;
    }
  }
  return out;
}
