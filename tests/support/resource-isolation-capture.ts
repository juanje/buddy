// tests/support/resource-isolation-capture.ts — NFR-SEC-21 session system prompt capture.
// Uses the same session openers as production.

import { createAgentSession, ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { assembleSystemPrompt } from "../../backends/prompt";
import { buddyAgentDir, buddyModelsPath, globalConfigDir } from "../../backends/global-config";
import { createDateGuardExtension } from "../../backends/date-guard";
import { buddySessionsDir } from "../../backends/session-paths";
import { buildAgentToolset } from "../../backends/session-boot";
import { openRealMaintenanceSession } from "../../backends/consolidation-runner";
import { openRealWikiSynthesisSession } from "../../backends/wiki-synthesis";
import { createBuddyResourceLoader } from "../../backends/resource-loader";
import { EXCLUDED_TOOLS } from "../../shared/defaults";
import { initTestGitRepo } from "./test-git";

export const ROOT_AGENTS_MARKER = "NFRSEC21_ROOT_AGENTS_MARKER";
export const PARENT_AGENTS_MARKER = "NFRSEC21_PARENT_AGENTS_MARKER";
export const APPEND_SYSTEM_MARKER = "NFRSEC21_APPEND_SYSTEM_MARKER";
export const DECOY_SKILL_MARKER = "NFRSEC21_DECOY_SKILL_MARKER";

export const WIKI_SYNTHESIS_INSTRUCTION =
  "You evaluate wiki synthesis candidates and file approved concepts using wiki_file only.";

// Minimal model handle for offline test runtime — full Model shape not needed here.
const TEST_MODEL = { id: "test-model", provider: "buddy-test" } as never;

type PiSession = Awaited<ReturnType<typeof createAgentSession>>["session"];

function readSystemPrompt(session: PiSession): string {
  return session.systemPrompt;
}

function writeSkill(dir: string, name: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "SKILL.md"),
    `---\nname: ${name}\ndescription: Decoy skill for NFR-SEC-21\n---\n\n${DECOY_SKILL_MARKER}\n`,
    "utf8",
  );
}

/** Decoys that a leaky DefaultResourceLoader would discover and inject. */
export function installResourceLeakDecoys(
  parentDir: string,
  rootDir: string,
  homeDir: string,
): void {
  writeFileSync(join(parentDir, "AGENTS.md"), `# Parent\n\n${PARENT_AGENTS_MARKER}\n`, "utf8");
  writeFileSync(join(rootDir, "AGENTS.md"), `# Root\n\n${ROOT_AGENTS_MARKER}\n`, "utf8");
  mkdirSync(join(rootDir, "agent_brain", "identity"), { recursive: true });
  writeFileSync(join(rootDir, "agent_brain", "identity", "SOUL.md"), "# Soul\n\nTest.\n", "utf8");
  writeFileSync(
    join(rootDir, "agent_brain", "identity", "USER.md"),
    "# User\n\n## About\n\n- **Name:** Test\n",
    "utf8",
  );

  writeSkill(join(rootDir, ".agents", "skills", "proj-skill"), "proj-skill");
  writeSkill(join(rootDir, ".pi", "skills", "pi-skill"), "pi-skill");
  writeSkill(join(homeDir, ".agents", "skills", "home-skill"), "home-skill");

  mkdirSync(join(rootDir, ".pi", "prompts"), { recursive: true });
  writeFileSync(join(rootDir, ".pi", "prompts", "leak.md"), "# Leak\n", "utf8");
  writeFileSync(join(rootDir, ".pi", "APPEND_SYSTEM.md"), `${APPEND_SYSTEM_MARKER}\n`, "utf8");
}

export async function createTestModelRuntime(): Promise<ModelRuntime> {
  const modelsPath = buddyModelsPath();
  writeFileSync(
    modelsPath,
    JSON.stringify({
      providers: {
        "buddy-test": {
          name: "Buddy test",
          baseUrl: "http://127.0.0.1:9/v1",
          api: "openai-completions",
          apiKey: "test",
          models: [{ id: "test-model" }],
        },
      },
    }),
    "utf8",
  );
  process.env.PI_OFFLINE = "1";
  return ModelRuntime.create({
    authPath: join(globalConfigDir(), "auth.json"),
    modelsPath,
    modelsStorePath: join(globalConfigDir(), "models-store.json"),
    allowModelNetwork: false,
  });
}

export async function captureChatSystemPrompt(
  rootDir: string,
  modelRuntime: ModelRuntime,
): Promise<string> {
  const sessionStart = new Date("2026-10-07T12:00:00Z");
  const { prompt } = assembleSystemPrompt(rootDir, sessionStart);
  const resourceLoader = await createBuddyResourceLoader({
    cwd: rootDir,
    systemPrompt: () => prompt,
    extensionFactories: [createDateGuardExtension(sessionStart)],
  });

  const toolset = buildAgentToolset(rootDir, {
    requestPermission: async () => true,
    showFile: () => {},
    sessionAllowedPaths: new Set(),
  });

  const { session } = await createAgentSession({
    cwd: rootDir,
    agentDir: buddyAgentDir(),
    resourceLoader,
    sessionManager: SessionManager.create(rootDir, buddySessionsDir(rootDir)),
    excludeTools: [...EXCLUDED_TOOLS],
    tools: toolset.names,
    customTools: toolset.customTools,
    modelRuntime,
    model: TEST_MODEL,
    thinkingLevel: "off",
  });
  return readSystemPrompt(session);
}

export async function captureMaintenanceSystemPrompt(
  rootDir: string,
  modelRuntime: ModelRuntime,
): Promise<string> {
  const session = await openRealMaintenanceSession({ rootDir, modelRuntime, depth: 1 });
  return readSystemPrompt(session as PiSession);
}

export async function captureWikiSynthesisSystemPrompt(
  rootDir: string,
  modelRuntime: ModelRuntime,
): Promise<string> {
  const session = await openRealWikiSynthesisSession({
    rootDir,
    modelRuntime,
    counters: { created: 0, rejected: false },
  });
  return readSystemPrompt(session as PiSession);
}

export async function captureReflectSystemPrompt(
  rootDir: string,
  modelRuntime: ModelRuntime,
  forkFile: string,
): Promise<string> {
  const forkDir = join(rootDir, ".buddy", "reflect-sessions");
  mkdirSync(forkDir, { recursive: true });
  const sm = SessionManager.forkFrom(forkFile, rootDir, forkDir);

  const resourceLoader = await createBuddyResourceLoader({
    cwd: rootDir,
    systemPrompt: () => undefined,
  });

  const { session } = await createAgentSession({
    cwd: rootDir,
    agentDir: buddyAgentDir(),
    resourceLoader,
    sessionManager: sm,
    noTools: "all",
    modelRuntime,
    model: TEST_MODEL,
    thinkingLevel: "minimal",
  });
  return readSystemPrompt(session);
}

export async function prepareBuddyRoot(rootDir: string): Promise<void> {
  mkdirSync(join(rootDir, ".buddy", "sessions"), { recursive: true });
  await initTestGitRepo(rootDir);
}
