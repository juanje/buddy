// tests/unit/reflect-child-errors.test.ts — session-end model resolution + API error propagation.

import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentEvent } from "../../shared/api";

const logEvents = vi.hoisted(() => [] as Array<Record<string, unknown>>);
const createAgentSessionMock = vi.hoisted(() => vi.fn());
const modelRuntimeMock = vi.hoisted(() => ({
  getModel: vi.fn(),
  getAvailable: vi.fn(),
}));
const sessionPromptMock = vi.hoisted(() => vi.fn());
const readPiProviderMock = vi.hoisted(() => vi.fn(() => "anthropic"));

let capturedSubscribe: ((event: AgentEvent) => void) | undefined;

function completedReflect(text = "### Context\n\nWorked on feature.") {
  return [
    { type: "message_update", assistantMessageEvent: { type: "text_delta", delta: text } },
  ] as AgentEvent[];
}

function errored(message = "429: rate limit exceeded") {
  return [
    {
      type: "message_end",
      message: { role: "assistant", stopReason: "error", errorMessage: message, content: [] },
    },
  ] as AgentEvent[];
}

function mockSession(eventsOnPrompt: AgentEvent[]) {
  mockSessionSequence([eventsOnPrompt]);
}

function mockSessionSequence(responses: AgentEvent[][]) {
  let callIndex = 0;
  sessionPromptMock.mockImplementation(async () => {
    const events = responses[callIndex] ?? [];
    callIndex += 1;
    if (capturedSubscribe) {
      for (const event of events) capturedSubscribe(event);
    }
  });
  createAgentSessionMock.mockResolvedValue({
    session: {
      subscribe: (fn: (event: AgentEvent) => void) => {
        capturedSubscribe = fn;
        return () => {
          capturedSubscribe = undefined;
        };
      },
      prompt: sessionPromptMock,
      dispose: vi.fn(),
    },
  });
}

vi.mock("node:child_process", () => ({ execSync: vi.fn() }));

vi.mock("@earendil-works/pi-coding-agent", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createAgentSession: createAgentSessionMock,
    SessionManager: { forkFrom: vi.fn(() => ({})) },
    DefaultResourceLoader: vi.fn(function DefaultResourceLoader() {
      return { reload: vi.fn() };
    }),
  };
});

vi.mock("../../backends/provider-auth", () => ({
  createBuddyModelRuntime: vi.fn(async () => modelRuntimeMock),
}));

vi.mock("../../backends/pi-http-dispatcher", () => ({
  alignHttpDispatcherWithPi: vi.fn(),
}));

vi.mock("../../backends/app-logger", () => ({
  logEvent: vi.fn((_root: string, event: Record<string, unknown>) => {
    logEvents.push(event);
  }),
}));

vi.mock("../../backends/git", () => ({
  commitAll: vi.fn(async () => {}),
}));

vi.mock("../../backends/maintenance", () => ({
  acquireLock: vi.fn(() => true),
  releaseLock: vi.fn(),
}));

vi.mock("../../backends/usage-tracker", () => ({
  recordSessionUsage: vi.fn(),
}));

vi.mock("../../backends/crash-recovery", () => ({
  clearSessionPersistence: vi.fn(),
}));

vi.mock("../../shared/pi-settings", () => ({
  readPiProvider: readPiProviderMock,
}));

import { runReflect } from "../../backends/reflect-child";

describe("reflect-child session model resolution (Bug 1)", () => {
  let rootDir: string;
  let forkFile: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), "reflect-child-"));
    mkdirSync(join(rootDir, ".buddy", "reflect-sessions"), { recursive: true });
    forkFile = join(rootDir, ".buddy", "reflect-sessions", "2026-08-16-test.jsonl");
    writeFileSync(forkFile, "{}");
    logEvents.length = 0;
    createAgentSessionMock.mockReset();
    sessionPromptMock.mockReset();
    modelRuntimeMock.getModel.mockReset();
    modelRuntimeMock.getAvailable.mockReset();
    readPiProviderMock.mockReturnValue("anthropic");
  });

  afterEach(() => {
    if (rootDir && existsSync(rootDir)) rmSync(rootDir, { recursive: true, force: true });
  });

  async function runSessionEndReflect(): Promise<void> {
    await runReflect(
      rootDir,
      forkFile,
      "session-end",
      "abc12345",
      "2026-08-16",
      "14:30",
      "15:45",
    );
  }

  it("resolves and passes an explicit model for session-end reflect", async () => {
    const fastModel = { id: "claude-haiku-4-5", provider: "anthropic" };
    modelRuntimeMock.getModel.mockReturnValue(fastModel);
    mockSession(completedReflect());

    await runSessionEndReflect();

    expect(createAgentSessionMock).toHaveBeenCalledOnce();
    expect(createAgentSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: fastModel,
        thinkingLevel: "minimal",
      }),
    );
  });

  it("still resolves an explicit model for checkpoint reflect", async () => {
    const fastModel = { id: "claude-haiku-4-5", provider: "anthropic" };
    modelRuntimeMock.getModel.mockReturnValue(fastModel);
    mockSession(completedReflect("### Context\n\nCheckpoint note."));

    await runReflect(
      rootDir,
      forkFile,
      "checkpoint",
      "abc12345",
      "2026-08-16",
      "14:30",
      "15:45",
      "2026-08-16",
      "14:30",
    );

    expect(createAgentSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: fastModel,
        thinkingLevel: "minimal",
      }),
    );
  });

  it("degrades gracefully when no fast model is available", async () => {
    modelRuntimeMock.getModel.mockReturnValue(undefined);
    modelRuntimeMock.getAvailable.mockResolvedValue([]);
    mockSession(completedReflect());

    await runSessionEndReflect();

    expect(createAgentSessionMock).toHaveBeenCalledOnce();
    const options = createAgentSessionMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(options.model).toBeUndefined();
    expect(options.thinkingLevel).toBe("minimal");
  });
});

describe("reflect-child API error propagation (Bug 2)", () => {
  let rootDir: string;
  let forkFile: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), "reflect-child-"));
    mkdirSync(join(rootDir, ".buddy", "reflect-sessions"), { recursive: true });
    forkFile = join(rootDir, ".buddy", "reflect-sessions", "2026-08-16-test.jsonl");
    writeFileSync(forkFile, "{}");
    logEvents.length = 0;
    createAgentSessionMock.mockReset();
    sessionPromptMock.mockReset();
    modelRuntimeMock.getModel.mockReturnValue({ id: "claude-haiku-4-5", provider: "anthropic" });
  });

  afterEach(() => {
    if (rootDir && existsSync(rootDir)) rmSync(rootDir, { recursive: true, force: true });
  });

  it("throws and logs reflect_error when the provider returns stopReason error", async () => {
    mockSession(errored("401: Invalid API key"));

    await expect(
      runReflect(rootDir, forkFile, "session-end", "abc12345", "2026-08-16", "14:30", "15:45"),
    ).rejects.toThrow(/401/);

    const errorLog = logEvents.find((entry) => entry.event === "reflect_error");
    expect(errorLog).toBeDefined();
    expect(String(errorLog?.message)).toContain("401");
    expect(logEvents.some((entry) => entry.event === "reflect_skipped")).toBe(false);
  });

  it("preserves rate-limit detail in reflect_error when all retries are exhausted", async () => {
    vi.useFakeTimers();
    mockSessionSequence([
      errored("429: rate limit exceeded — retry after 30s"),
      errored("429: rate limit exceeded — retry after 30s"),
      errored("429: rate limit exceeded — retry after 30s"),
      errored("429: rate limit exceeded — retry after 30s"),
    ]);

    const runPromise = runReflect(
      rootDir,
      forkFile,
      "session-end",
      "sess9999",
      "2026-08-16",
      "01:00",
      "02:00",
    );
    const expectation = expect(runPromise).rejects.toThrow(/rate limit/);

    await vi.runAllTimersAsync();
    await expectation;

    const errorLog = logEvents.find((entry) => entry.event === "reflect_error");
    expect(errorLog).toMatchObject({
      event: "reflect_error",
      session: "sess9999",
      mode: "session-end",
    });
    expect(String(errorLog?.message)).toContain("429");
    expect(String(errorLog?.message)).toContain("rate limit");
    expect(logEvents.filter((entry) => entry.event === "reflect_retry")).toHaveLength(3);
    vi.useRealTimers();
  });
});

describe("reflect-child retry backoff", () => {
  let rootDir: string;
  let forkFile: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), "reflect-child-retry-"));
    mkdirSync(join(rootDir, ".buddy", "reflect-sessions"), { recursive: true });
    mkdirSync(join(rootDir, "logs"), { recursive: true });
    forkFile = join(rootDir, ".buddy", "reflect-sessions", "2026-08-16-test.jsonl");
    writeFileSync(forkFile, "{}");
    logEvents.length = 0;
    createAgentSessionMock.mockReset();
    sessionPromptMock.mockReset();
    modelRuntimeMock.getModel.mockReturnValue({ id: "claude-haiku-4-5", provider: "anthropic" });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    if (rootDir && existsSync(rootDir)) rmSync(rootDir, { recursive: true, force: true });
  });

  it("retries after a retryable error and completes on the next attempt", async () => {
    mockSessionSequence([
      errored("429: rate limit exceeded"),
      completedReflect("### Context\n\nRecovered after retry."),
    ]);

    const runPromise = runReflect(
      rootDir,
      forkFile,
      "session-end",
      "abc12345",
      "2026-08-16",
      "14:30",
      "15:45",
    );

    await vi.runAllTimersAsync();
    await runPromise;

    expect(sessionPromptMock).toHaveBeenCalledTimes(2);
    expect(logEvents.filter((entry) => entry.event === "reflect_retry")).toHaveLength(1);
    expect(logEvents.some((entry) => entry.event === "reflect_complete")).toBe(true);
    expect(logEvents.some((entry) => entry.event === "reflect_error")).toBe(false);
  });

  it("does not wait before throwing a non-retryable error", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    mockSession(errored("401: Invalid API key"));

    await expect(
      runReflect(rootDir, forkFile, "session-end", "abc12345", "2026-08-16", "14:30", "15:45"),
    ).rejects.toThrow(/401/);

    expect(sessionPromptMock).toHaveBeenCalledOnce();
    const retryDelays = setTimeoutSpy.mock.calls
      .map((call) => call[1])
      .filter((delay): delay is number => delay === 30_000 || delay === 60_000 || delay === 90_000);
    expect(retryDelays).toHaveLength(0);
    setTimeoutSpy.mockRestore();
  });

  it("logs reflect_error with the last retryable error after exhausting retries", async () => {
    mockSessionSequence([
      errored("429: first rate limit"),
      errored("429: second rate limit"),
      errored("429: third rate limit"),
      errored("429: final rate limit"),
    ]);

    const runPromise = runReflect(
      rootDir,
      forkFile,
      "session-end",
      "abc12345",
      "2026-08-16",
      "14:30",
      "15:45",
    );
    const expectation = expect(runPromise).rejects.toThrow(/final rate limit/);

    await vi.runAllTimersAsync();
    await expectation;

    expect(sessionPromptMock).toHaveBeenCalledTimes(4);
    expect(logEvents.filter((entry) => entry.event === "reflect_retry")).toHaveLength(3);
    const errorLog = logEvents.find((entry) => entry.event === "reflect_error");
    expect(String(errorLog?.message)).toContain("final rate limit");
  });
});
