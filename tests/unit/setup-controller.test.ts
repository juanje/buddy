// tests/unit/setup-controller.test.ts — FR-SHELL-06 wizard back navigation.

import { describe, expect, it } from "vitest";
import { get } from "svelte/store";

import { createSetupController } from "../../src/lib/setup-controller";
import { makeSetupWorkerFake } from "../support/setup-worker-fake";

describe("createSetupController back()", () => {
  it("stays on language when already on the first step", () => {
    const wizard = createSetupController(makeSetupWorkerFake({}));
    wizard.back();
    expect(get(wizard.step)).toBe("language");
  });

  it("returns to the previous step, skipping prerequisites when git is installed", async () => {
    const wizard = createSetupController(makeSetupWorkerFake({}));
    wizard.selectLanguage("es");
    wizard.setPersonalization("Test User", "About me");
    await wizard.checkPrerequisites();
    wizard.next(); // welcome
    wizard.next(); // personalization → location (prerequisites skipped)
    expect(get(wizard.step)).toBe("location");

    wizard.back();
    expect(get(wizard.step)).toBe("personalization");
    expect(get(wizard.userName)).toBe("Test User");
    expect(get(wizard.userAbout)).toBe("About me");

    wizard.back();
    expect(get(wizard.step)).toBe("welcome");

    wizard.back();
    expect(get(wizard.step)).toBe("language");
  });

  it("walks back from model through provider to location", async () => {
    const wizard = createSetupController(
      makeSetupWorkerFake({
        validateLocation: async () => ({ status: "ok-new" }),
        configureProviderKey: async () => ({ valid: true }),
      }),
    );
    wizard.selectLanguage("en");
    wizard.next();
    wizard.setPersonalization("Ada");
    wizard.next();
    await wizard.checkPrerequisites();
    wizard.next();
    await wizard.pickLocation("/tmp/buddy");
    wizard.next();
    wizard.selectProvider("anthropic");
    await wizard.submitApiKey("valid-key");
    wizard.next();
    expect(get(wizard.step)).toBe("model");

    wizard.back();
    expect(get(wizard.step)).toBe("provider");
    expect(get(wizard.provider)).toBe("anthropic");

    wizard.back();
    expect(get(wizard.step)).toBe("location");
    expect(get(wizard.location)).toBe("/tmp/buddy");
  });

  it("requires re-authentication when importing a buddy instance with settings but no auth", async () => {
    const wizard = createSetupController(
      makeSetupWorkerFake({
        validateLocation: async () => ({
          status: "existing-buddy",
          buddySettings: { provider: "anthropic", model: "claude-haiku-4-5" },
        }),
        getAuthStatus: async () => ({
          providers: [
            { piProviderId: "anthropic", buddyProvider: "anthropic", hasAuth: false },
          ],
        }),
        runSetup: async () => {
          throw new Error("runSetup should not run without auth");
        },
      }),
    );
    await wizard.pickLocation("/tmp/old-ab");
    const outcome = await wizard.importExisting();
    expect(outcome).toBe("needs-provider");
    expect(get(wizard.step)).toBe("provider");
    expect(get(wizard.provider)).toBe("anthropic");
    expect(get(wizard.model)).toBe("claude-haiku-4-5");
    expect(get(wizard.completed)).toBe(false);
  });

  it("adopts directly when importing a buddy instance with settings and valid auth", async () => {
    let setupCalled = false;
    const wizard = createSetupController(
      makeSetupWorkerFake({
        validateLocation: async () => ({
          status: "existing-buddy",
          buddySettings: { provider: "anthropic", model: "claude-haiku-4-5" },
        }),
        getAuthStatus: async () => ({
          providers: [
            { piProviderId: "anthropic", buddyProvider: "anthropic", hasAuth: true },
          ],
        }),
        runSetup: async () => {
          setupCalled = true;
        },
      }),
    );
    await wizard.pickLocation("/tmp/old-ab");
    const outcome = await wizard.importExisting();
    expect(outcome).toBe("adopted");
    expect(setupCalled).toBe(true);
    expect(get(wizard.completed)).toBe(true);
  });
});
