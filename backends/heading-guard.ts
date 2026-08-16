// backends/heading-guard.ts — FR-GUARD-01 / FR-GUARD-01b: heading-snapshot guard.
//
// Captures headings (`#`/`##`) and frontmatter presence before a write/edit,
// restores the file if any heading disappeared or frontmatter was stripped.
// Same capture/check pattern as hebbian-guard.ts.
// FR-GUARD-01b: denylist scope — only protected files (see PROTECTED_FILES).
// FR-GUARD-01c: tool result enrichment — surfaces revert to the model.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { HEADING_GUARD_DAILY_LOG_RE, PROTECTED_FILES } from "../shared/defaults";
import { toBuddyRelPath } from "../shared/path-utils";
import { logEvent } from "./app-logger";

export interface HeadingGuardResult {
  reverted: boolean;
  lostHeadings?: string[];
}

export interface HeadingGuard {
  capture(path: string): void;
  check(path: string): HeadingGuardResult;
}

function extractHeadings(content: string): string[] {
  return content.split("\n")
    .filter((line) => line.startsWith("# ") || line.startsWith("## "))
    .map((line) => {
      if (line.startsWith("## ")) return line.slice(3).trim();
      return line.slice(2).trim();
    });
}

function hasFrontmatter(content: string): boolean {
  return content.startsWith("---\n") && content.indexOf("\n---", 4) >= 0;
}

function isProtectedFile(relPath: string): boolean {
  if ((PROTECTED_FILES as readonly string[]).includes(relPath)) return true;
  return HEADING_GUARD_DAILY_LOG_RE.test(relPath);
}

export function createHeadingGuard(rootDir: string): HeadingGuard {
  const snapshots = new Map<string, { headings: string[]; hadFrontmatter: boolean; content: string }>();

  return {
    capture(path: string) {
      const relPath = toBuddyRelPath(rootDir, path);
      if (!relPath || !isProtectedFile(relPath)) return;
      const absPath = resolve(rootDir, relPath);
      if (!existsSync(absPath)) return;
      let content: string;
      try {
        content = readFileSync(absPath, "utf8");
      } catch {
        return;
      }
      snapshots.set(relPath, {
        headings: extractHeadings(content),
        hadFrontmatter: hasFrontmatter(content),
        content,
      });
    },

    check(path: string): HeadingGuardResult {
      const relPath = toBuddyRelPath(rootDir, path);
      if (!relPath) return { reverted: false };
      const snapshot = snapshots.get(relPath);
      if (!snapshot) return { reverted: false };
      snapshots.delete(relPath);

      const absPath = resolve(rootDir, relPath);
      let currentContent: string;
      try {
        currentContent = readFileSync(absPath, "utf8");
      } catch {
        return { reverted: false };
      }

      const currentHeadings = extractHeadings(currentContent);
      const lost = snapshot.headings.filter((h) => !currentHeadings.includes(h));
      const frontmatterStripped = snapshot.hadFrontmatter && !hasFrontmatter(currentContent);

      if (lost.length === 0 && !frontmatterStripped) return { reverted: false };

      writeFileSync(absPath, snapshot.content, "utf8");
      return { reverted: true, lostHeadings: lost };
    },
  };
}

// --- afterToolCall hook (FR-GUARD-01c) ---

export interface HeadingGuardInstallable {
  agent: {
    beforeToolCall?: unknown;
    afterToolCall?: unknown;
  };
}

interface ToolResultLike {
  content: unknown;
  details?: unknown;
}

function enrichResultWithRevert(result: ToolResultLike, lostHeadings: string[]): void {
  const headingList = lostHeadings.map((h) => `"${h}"`).join(", ");
  const message =
    `\n\n⚠️ Write reverted: the change removed protected section heading(s) ${headingList}. ` +
    `This file is structurally protected — edits must preserve all existing headings. ` +
    `Re-read the file and retry without removing any headings.`;

  const { content } = result;
  if (Array.isArray(content) && content.length > 0 && content[0]?.type === "text") {
    content[0] = { type: "text", text: String(content[0].text ?? "") + message };
  } else if (typeof content === "string") {
    (result as { content: string }).content = content + message;
  } else {
    (result as { content: unknown }).content = [{ type: "text", text: message.trimStart() }];
  }
}

function enrichResultWithFrontmatterRevert(result: ToolResultLike): void {
  const message =
    `\n\n⚠️ Write reverted: the change stripped the YAML frontmatter block from a protected file. ` +
    `Edits must preserve the existing frontmatter. Re-read the file and retry.`;

  const { content } = result;
  if (Array.isArray(content) && content.length > 0 && content[0]?.type === "text") {
    content[0] = { type: "text", text: String(content[0].text ?? "") + message };
  } else if (typeof content === "string") {
    (result as { content: string }).content = content + message;
  } else {
    (result as { content: unknown }).content = [{ type: "text", text: message.trimStart() }];
  }
}

/**
 * Install the heading guard as beforeToolCall/afterToolCall hooks (FR-GUARD-01c).
 *
 * Chains with existing hooks. On revert, enriches the tool result so the model
 * knows the write was rolled back and can retry correctly.
 */
export function installHeadingGuardHook(
  session: HeadingGuardInstallable,
  rootDir: string,
  sessionId?: string,
): void {
  const guard = createHeadingGuard(rootDir);

  const originalBefore = session.agent.beforeToolCall as
    | ((ctx: unknown, signal?: AbortSignal) => Promise<unknown>) | undefined;
  session.agent.beforeToolCall = async (
    ctx: { toolCall: { name: string }; args: unknown },
    signal?: AbortSignal,
  ) => {
    const name = ctx.toolCall.name;
    if (name === "write" || name === "edit") {
      const path = (ctx.args as Record<string, unknown>)?.path;
      if (typeof path === "string") guard.capture(path);
    }
    return originalBefore?.(ctx, signal);
  };

  const originalAfter = (session.agent as unknown as Record<string, unknown>).afterToolCall as
    | ((ctx: unknown, signal?: AbortSignal) => Promise<unknown>) | undefined;
  (session.agent as unknown as Record<string, unknown>).afterToolCall = async (
    ctx: { toolCall: { name: string }; args: unknown; result: ToolResultLike; isError: boolean },
    signal?: AbortSignal,
  ) => {
    const name = ctx.toolCall.name;
    if ((name === "write" || name === "edit") && !ctx.isError) {
      const path = (ctx.args as Record<string, unknown>)?.path;
      if (typeof path === "string") {
        const result = guard.check(path);
        if (result.reverted) {
          logEvent(rootDir, {
            event: "heading_guard_revert",
            session: sessionId ?? "unknown",
            path,
            lostHeadings: result.lostHeadings,
          });
          if (result.lostHeadings && result.lostHeadings.length > 0) {
            enrichResultWithRevert(ctx.result, result.lostHeadings);
          } else {
            enrichResultWithFrontmatterRevert(ctx.result);
          }
        }
      }
    }
    return originalAfter?.(ctx, signal);
  };
}
