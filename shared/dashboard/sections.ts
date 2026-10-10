// shared/dashboard/sections.ts — Sections primitive parser (FR-DASH-06).

import type { FieldType, SourceDefinition } from "./source-fields";
import { inferInlineSourceDefinition } from "./inline-source";

const HEADING = /^##\s+(.+)$/;
const CHECKBOX = /^-\s+\[( |x|X)\]\s+(.*)$/;
const LIST_ITEM = /^-\s+(?!\[)(.+)$/;
const SUB_BULLET = /^-\s+(.+)$/;
const KV = /^([\w][\w_]*):\s*(.+)$/;

export function parseSections(markdown: string): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  let group = "";
  let pending: Record<string, unknown> | null = null;
  let itemIndent = -1;

  const flush = () => {
    if (pending && typeof pending.text === "string" && pending.text !== "") {
      rows.push({ ...pending, group });
    }
    pending = null;
    itemIndent = -1;
  };

  for (const rawLine of markdown.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    const indent = rawLine.length - rawLine.trimStart().length;

    if (indent === 0) {
      const heading = HEADING.exec(trimmed);
      if (heading) {
        flush();
        group = heading[1].trim();
        continue;
      }
    }

    if (!group) continue;

    const isListLine = CHECKBOX.test(trimmed) || LIST_ITEM.test(trimmed);
    if (isListLine && (pending === null || indent <= itemIndent)) {
      const cb = CHECKBOX.exec(trimmed);
      if (cb) {
        flush();
        itemIndent = indent;
        pending = { text: cb[2].trim(), done: cb[1].toLowerCase() === "x" };
        continue;
      }
      const li = LIST_ITEM.exec(trimmed);
      if (li) {
        flush();
        itemIndent = indent;
        pending = { text: li[1].trim() };
        continue;
      }
    }

    if (pending && indent > itemIndent && SUB_BULLET.test(trimmed)) {
      const sub = SUB_BULLET.exec(trimmed)!;
      const body = sub[1].trim();
      const kv = KV.exec(body);
      if (kv) {
        pending[kv[1]] = kv[2].trim();
      } else {
        const prev = typeof pending.detail === "string" ? `${pending.detail} ` : "";
        pending.detail = (prev + body).trim();
      }
    }
  }

  flush();
  return rows;
}

export function sectionsFit(markdown: string): boolean {
  let group: string | null = null;
  let itemIndent = -1;
  let pending = false;
  for (const rawLine of markdown.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    const indent = rawLine.length - rawLine.trimStart().length;
    if (indent === 0 && HEADING.test(trimmed)) {
      group = trimmed.replace(/^##\s+/, "").trim();
      itemIndent = -1;
      pending = false;
      continue;
    }
    if (!group) continue;
    const isListLine = CHECKBOX.test(trimmed) || LIST_ITEM.test(trimmed);
    if (isListLine && (!pending || indent <= itemIndent)) {
      itemIndent = indent;
      pending = true;
      return true;
    }
  }
  return false;
}

export function inferSectionsSourceDefinition(rows: Record<string, unknown>[]): SourceDefinition {
  const def = inferInlineSourceDefinition(rows);
  const fields: Record<string, FieldType> = {
    text: { kind: "string" },
    group: { kind: "string" },
    ...def.fields,
  };
  if (rows.some((r) => typeof r.done === "boolean")) {
    fields.done = { kind: "string" };
  }
  if (rows.some((r) => r.detail !== undefined)) {
    fields.detail = { kind: "string" };
  }
  return { fields };
}
