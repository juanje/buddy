// backends/skill-tools.ts — FR-SKILL-01..03: procedural prompts as zero-input Pi tools.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Type } from "typebox";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";

import {
  loadConsolidationState,
  saveConsolidationState,
} from "../shared/consolidation-state";
import { BRAIN_SUBDIRS } from "../shared/brain-paths";
import { parseFrontmatter } from "../shared/frontmatter";
import { buddyPath } from "./brain-paths";
import { recordSkillInvocation } from "./skill-usage-tracking";

interface SkillDescriptor {
  name: string;
  label: string;
  description: string;
  promptFile: string;
}

const SKILL_REGISTRY: SkillDescriptor[] = [
  {
    name: "process_conversation",
    label: "Process conversation",
    description:
      "Reflect on the current conversation: extract decisions, lessons, context, tasks, ideas, and observations into the daily log. Use when the user asks to save/reflect/capture the session.",
    promptFile: "process-conversation.md",
  },
];

const LEARNED_SKILL_TOOL_KEYS = ["tool_name", "tool_description"] as const;
const CLOSED_FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;

function unwrapFrontmatterValue(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/** Agent-authored skills from agent_brain/skills/ (FR-SKILL-06). */
export function buildLearnedSkillTools(
  rootDir: string,
  coreNames: Set<string>,
): ToolDefinition[] {
  const skillsDir = buddyPath(rootDir, BRAIN_SUBDIRS.skills);
  if (!existsSync(skillsDir)) return [];

  const tools: ToolDefinition[] = [];
  for (const entry of readdirSync(skillsDir)) {
    if (!entry.endsWith(".md") || entry === ".gitkeep") continue;
    const filePath = join(skillsDir, entry);
    try {
      const content = readFileSync(filePath, "utf8");
      if (!CLOSED_FRONTMATTER.test(content)) {
        console.warn(`[skill-tools] learned skill '${entry}' has no closed frontmatter block; skipping`);
        continue;
      }
      const fm = parseFrontmatter(content);
      const toolName = unwrapFrontmatterValue(fm.tool_name);
      const toolDesc = unwrapFrontmatterValue(fm.tool_description);
      if (!toolName || !toolDesc) continue;
      if (coreNames.has(toolName)) {
        console.warn(
          `[skill-tools] learned skill '${toolName}' collides with core; skipping`,
        );
        continue;
      }
      tools.push(
        defineTool({
          name: toolName,
          label: toolName.replace(/_/g, " "),
          description: toolDesc,
          parameters: Type.Object({}),
          async execute() {
            const body = readFileSync(filePath, "utf8");
            const state = loadConsolidationState(rootDir);
            const updated = recordSkillInvocation(state, toolName);
            saveConsolidationState(rootDir, updated);
            return {
              content: [{ type: "text", text: body }],
              details: {},
            };
          },
        }),
      );
    } catch (err) {
      console.warn(`[skill-tools] failed to parse ${entry}: ${err}`);
    }
  }
  return tools;
}

/** Core + learned skill tools for a live or maintenance session. */
export function buildAllSkillTools(promptsDir: string, rootDir: string): ToolDefinition[] {
  const core = buildSkillTools(promptsDir, { rootDir });
  const coreNames = new Set(skillToolNames(core));
  return [...core, ...buildLearnedSkillTools(rootDir, coreNames)];
}

export function missingLearnedSkillToolKeys(content: string): string[] {
  const fields = parseFrontmatter(content);
  return LEARNED_SKILL_TOOL_KEYS.filter(
    (key) => !(key in fields) || fields[key].trim().length === 0,
  );
}

export function buildSkillTools(
  promptsDir: string,
  options?: { rootDir?: string },
): ToolDefinition[] {
  const rootDir = options?.rootDir;
  return SKILL_REGISTRY.filter((skill) =>
    existsSync(join(promptsDir, skill.promptFile)),
  ).map((skill) =>
    defineTool({
      name: skill.name,
      label: skill.label,
      description: skill.description,
      parameters: Type.Object({}),
      async execute() {
        const content = readFileSync(join(promptsDir, skill.promptFile), "utf8");
        if (rootDir) {
          const state = loadConsolidationState(rootDir);
          const updated = recordSkillInvocation(state, skill.name);
          saveConsolidationState(rootDir, updated);
        }
        return {
          content: [{ type: "text", text: content }],
          details: {},
        };
      },
    }),
  );
}

export function skillToolNames(tools: ToolDefinition[]): string[] {
  return tools.map((tool) => tool.name);
}

/** Invoke a skill tool and return its text payload (tests + BDD). */
export async function executeSkillTool(
  tools: ToolDefinition[],
  name: string,
): Promise<string> {
  const tool = tools.find((entry) => entry.name === name);
  if (!tool) throw new Error(`Skill tool not found: ${name}`);

  const result = await tool.execute(
    "test-call",
    {},
    new AbortController().signal,
    () => {},
    {} as never,
  );
  const textBlock = result.content.find((block) => block.type === "text");
  return textBlock?.type === "text" ? textBlock.text : "";
}
