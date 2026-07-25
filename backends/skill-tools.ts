// backends/skill-tools.ts — FR-SKILL-01..03: procedural prompts as zero-input Pi tools.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Type } from "typebox";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";

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
  {
    name: "triage_inbox",
    label: "Triage inbox",
    description:
      "Process the GTD inbox: handle captures, review next actions, clean up stale items. Use when the user says 'triage', 'process inbox', or 'what should I work on?'",
    promptFile: "triage-inbox.md",
  },
];

/** Register skill tools for prompts deployed under ~/.buddy/prompts/. */
export function buildSkillTools(promptsDir: string): ToolDefinition[] {
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
