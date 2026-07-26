// tests/steps/fetch-url.steps.ts — FR-NET-01 fetch_url BDD.

import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import {
  buildFetchTools,
  executeFetchTool,
  type FetchHttpClient,
} from "../../backends/fetch-url";
import { FETCH_MAX_BYTES } from "../../shared/defaults";
import { createMinimalPdf } from "../support/minimal-pdf";
import type { BuddyWorld } from "../support/world";

/** 1×1 PNG (valid image bytes for vision tests). */
const MINIMAL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

interface FetchWorld extends BuddyWorld {
  buddyDir?: string;
  fetchTools?: ReturnType<typeof buildFetchTools>;
  lastToolResult?: string;
  lastToolDetails?: Record<string, unknown>;
}

function mockFetchClient(): FetchHttpClient {
  return async (url: string, init?: RequestInit) => {
    if (url.includes("missing")) {
      return new Response("not found", { status: 404, statusText: "Not Found" });
    }
    if (url.includes("slow")) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(new Response("late", { status: 200 })), 60_000);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    }
    if (url.includes("huge")) {
      const body = new Uint8Array(FETCH_MAX_BYTES + 1).fill(0x61);
      return new Response(body, {
        status: 200,
        headers: { "content-type": "text/html", "content-length": String(body.length) },
      });
    }
    if (url.includes(".pdf") || url.endsWith("report.pdf")) {
      return new Response(new Uint8Array(createMinimalPdf("Hello from PDF")), {
        status: 200,
        headers: { "content-type": "application/pdf" },
      });
    }
    if (url.includes(".png") || url.endsWith("photo.png")) {
      return new Response(new Uint8Array(MINIMAL_PNG), {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    }
    const html = `<!DOCTYPE html><html><head><title>Article Title</title></head><body><article><p>Article body text</p></article></body></html>`;
    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  };
}

Given("fetch_url is available with a mock HTTP client", function (this: FetchWorld) {
  if (!this.buddyDir) throw new Error("buddy repository not initialized");
  this.fetchTools = buildFetchTools(this.buddyDir, {
    fetchImpl: mockFetchClient(),
    fetchTimeoutMs: 50,
  });
});

Given("the buddy downloads directory does not exist", function (this: FetchWorld) {
  if (!this.buddyDir) throw new Error("buddy repository not initialized");
  const downloadsDir = join(this.buddyDir, "downloads");
  if (existsSync(downloadsDir)) rmSync(downloadsDir, { recursive: true, force: true });
});

When("fetch_url is called with {string}", async function (this: FetchWorld, url: string) {
  if (!this.fetchTools) throw new Error("fetch tools not initialized");
  const { text, details } = await executeFetchTool(this.fetchTools, "fetch_url", { url });
  this.lastToolResult = text;
  this.lastToolDetails = details as Record<string, unknown>;
});

Then("the fetch tool result contains {string}", function (this: FetchWorld, expected: string) {
  assert.ok(
    this.lastToolResult?.includes(expected),
    `expected tool result to contain "${expected}", got:\n${this.lastToolResult ?? "(none)"}`,
  );
});

Then(
  'the file "downloads" contains a markdown download for {string}',
  function (this: FetchWorld, slug: string) {
    if (!this.buddyDir) throw new Error("buddy repository not initialized");
    const downloadsDir = join(this.buddyDir, "downloads");
    assert.ok(existsSync(downloadsDir), "downloads directory missing");
    const files = readdirSync(downloadsDir).filter((name) => name.endsWith(".md"));
    assert.ok(files.length > 0, "expected at least one markdown download");
    assert.ok(
      files.some((name) => name.includes(slug)),
      `expected a download filename containing "${slug}", got: ${files.join(", ")}`,
    );
  },
);

Then('the file "downloads" contains a pdf download', function (this: FetchWorld) {
  if (!this.buddyDir) throw new Error("buddy repository not initialized");
  const downloadsDir = join(this.buddyDir, "downloads");
  assert.ok(existsSync(downloadsDir), "downloads directory missing");
  const files = readdirSync(downloadsDir).filter((name) => name.endsWith(".pdf"));
  assert.ok(files.length > 0, "expected at least one pdf download");
});

Then("the fetch details include image data", function (this: FetchWorld) {
  assert.equal(this.lastToolDetails?.contentType, "image/png");
  assert.ok(this.lastToolDetails?.savedPath, "expected savedPath in details");
  assert.ok(this.lastToolDetails?.imageBase64, "expected imageBase64 in details");
});

Then('the directory "downloads" exists', function (this: FetchWorld) {
  if (!this.buddyDir) throw new Error("buddy repository not initialized");
  assert.ok(existsSync(join(this.buddyDir, "downloads")), "expected downloads directory");
});
