// tests/unit/worker-core-auth.test.ts — FR-AUTH-02 worker auth error forwarding.

import { describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createWorkerCore } from "../../backends/worker-core";
import { APP_LOGS_DIR } from "../../shared/defaults";
import { toIsoDay } from "../../shared/dates";
import { FakeSession } from "../support/fake-session";

function frontendMock() {
  return {
    onAgentEvent: vi.fn(),
    onWorkerError: vi.fn(),
    onPermissionRequest: vi.fn(),
    onOAuthEvent: vi.fn(),
    onShowFile: vi.fn(),
    onDeferredDue: vi.fn(),
    onBudgetAlert: vi.fn(),
    onMaintenancePaused: vi.fn(),
    onSessionReady: vi.fn(),
    onAuthError: vi.fn(),
  };
}

describe("createWorkerCore auth errors", () => {
  it("calls onAuthError and logs auth_error for auth message_end events", () => {
    const dir = mkdtempSync(join(tmpdir(), "buddy-worker-auth-"));
    const rootDir = join(dir, "buddy");
    mkdirSync(rootDir, { recursive: true });
    const session = new FakeSession();
    const frontend = frontendMock();
    createWorkerCore(session, frontend, { rootDir });

    session.emitAuthError("OAuth refresh failed for anthropic");

    expect(frontend.onAuthError).toHaveBeenCalledWith({
      provider: "anthropic",
      message: "OAuth refresh failed for anthropic",
    });

    const logPath = join(rootDir, APP_LOGS_DIR, `${toIsoDay(new Date())}.jsonl`);
    const lines = readFileSync(logPath, "utf8").trim().split("\n");
    const last = JSON.parse(lines[lines.length - 1]!) as { event: string };
    expect(last.event).toBe("auth_error");

    rmSync(dir, { recursive: true, force: true });
  });
});
