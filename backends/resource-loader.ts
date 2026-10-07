// backends/resource-loader.ts — NFR-SEC-21: Pi SDK resource discovery disabled.

import {
  DefaultResourceLoader,
  type InlineExtension,
} from "@earendil-works/pi-coding-agent";

import { buddyAgentDir } from "./global-config";

export async function createBuddyResourceLoader(options: {
  cwd: string;
  systemPrompt: () => string | undefined;
  extensionFactories?: InlineExtension[];
}): Promise<DefaultResourceLoader> {
  const loader = new DefaultResourceLoader({
    cwd: options.cwd,
    agentDir: buddyAgentDir(),
    noSkills: true,
    noContextFiles: true,
    noExtensions: true,
    noPromptTemplates: true,
    noThemes: true,
    systemPromptOverride: options.systemPrompt,
    appendSystemPromptOverride: () => [],
    extensionFactories: options.extensionFactories,
  });
  await loader.reload();
  return loader;
}
