// tests/unit/maintenance-gate.test.ts — FR-CONSOL-10.
//
// The defect was not a wrong policy: it was that the maintenance session had no
// beforeToolCall hook at all, so the hardcoded denylist did not apply to an
// unattended session with full file tools. These tests therefore check the
// *wiring* — that installing the gate actually intercepts calls — not only the
// policy in isolation. A policy-only test would have passed against the bug.

import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createMaintenancePermissionPolicy,
  installMaintenanceGate,
  type GateInstallable,
} from "../../backends/consolidation-runner";

/** A Pi AgentSession cannot be constructed here; the gate only touches `agent`. */
function fakeSession(hook?: unknown): GateInstallable {
  return { agent: hook ? { beforeToolCall: hook } : {} } as unknown as GateInstallable;
}

async function call(
  session: GateInstallable,
  name: string,
  args: unknown,
): Promise<{ block?: boolean; reason?: string } | undefined> {
  const hook = session.agent.beforeToolCall as unknown as (
    ctx: { toolCall: { name: string }; args: unknown },
    signal: AbortSignal,
  ) => Promise<{ block?: boolean; reason?: string } | undefined>;
  return hook({ toolCall: { name }, args }, new AbortController().signal);
}

describe("installMaintenanceGate — wiring", () => {
  it("installs a beforeToolCall hook where there was none", () => {
    const session = fakeSession();
    expect(session.agent.beforeToolCall).toBeUndefined();
    installMaintenanceGate(session, "/home/buddy");
    expect(typeof session.agent.beforeToolCall).toBe("function");
  });

  it("chains an existing hook and lets its block win", async () => {
    const session = fakeSession(async () => ({ block: true, reason: "prior hook" }));
    installMaintenanceGate(session, "/home/buddy");
    const result = await call(session, "read", { path: "agent_brain/notes.md" });
    expect(result).toEqual({ block: true, reason: "prior hook" });
  });
});

describe("installMaintenanceGate — policy through the hook", () => {
  let root: string;
  let home: string;

  function setup(): GateInstallable {
    home = mkdtempSync(join(tmpdir(), "maint-gate-"));
    root = join(home, "buddy");
    const session = fakeSession();
    installMaintenanceGate(session, root);
    return session;
  }

  it("blocks denylisted credentials — NFR-SEC-04", async () => {
    const session = setup();
    for (const path of [
      join(home, ".ssh", "id_rsa"),
      join(home, ".aws", "credentials"),
      join(root, ".env"),
      join(home, ".buddy", "auth.json"),
    ]) {
      expect(await call(session, "read", { path }), path).toMatchObject({ block: true });
    }
    rmSync(home, { recursive: true, force: true });
  });

  it("blocks reads outside the workspace, since nobody can be asked", async () => {
    const session = setup();
    expect(await call(session, "read", { path: "/etc/hosts" })).toMatchObject({ block: true });
    rmSync(home, { recursive: true, force: true });
  });

  it("blocks writes to the model configuration — NFR-SEC-06", async () => {
    const session = setup();
    expect(
      await call(session, "write", { path: join(root, ".pi", "settings.json") }),
    ).toMatchObject({ block: true });
    rmSync(home, { recursive: true, force: true });
  });

  it("allows work inside the workspace", async () => {
    const session = setup();
    expect(await call(session, "read", { path: "agent_brain/observations.md" })).toBeUndefined();
    expect(await call(session, "write", { path: "agent_brain/concepts/new.md" })).toBeUndefined();
    rmSync(home, { recursive: true, force: true });
  });

  it("allows promoting a trait into SOUL.md — designed consolidation behaviour", async () => {
    const session = setup();
    const path = join(root, "agent_brain", "identity", "SOUL.md");
    expect(await call(session, "write", { path })).toBeUndefined();
    rmSync(home, { recursive: true, force: true });
  });
});

describe("createMaintenancePermissionPolicy", () => {
  it("records refusals instead of dropping them silently", async () => {
    const policy = createMaintenancePermissionPolicy();
    await policy.askUser({ kind: "outside", op: "read", path: "/etc/hosts" });
    expect(policy.refusedPaths()).toEqual(["/etc/hosts"]);
  });

  it("flags that identity changed so the run can surface it (FR-CONSOL-11)", async () => {
    const policy = createMaintenancePermissionPolicy();
    expect(policy.changedIdentity()).toBe(false);
    const allowed = await policy.askUser({
      kind: "identity-write",
      op: "write",
      path: "/home/buddy/agent_brain/identity/SOUL.md",
    });
    expect(allowed).toBe(true);
    expect(policy.changedIdentity()).toBe(true);
  });
});
