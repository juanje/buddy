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
  /** Requests the mock client actually received (NFR-SEC-12). */
  requestedUrls?: string[];
  /** Scripted DNS answers, so SSRF rules are testable without network. */
  dnsAnswers?: Map<string, string[]>;
  /** Scripted redirects: from URL → Location header. */
  redirects?: Map<string, string>;
  /** Largest number of bytes the client was asked to hand over. */
  streamedBytes?: number;
}

function mockFetchClient(world: FetchWorld): FetchHttpClient {
  return async (url: string, init?: RequestInit) => {
    world.requestedUrls!.push(url);

    const redirectTo = world.redirects?.get(url);
    if (redirectTo) {
      return new Response(null, { status: 302, headers: { location: redirectTo } });
    }

    if (url.includes("endless")) {
      // No content-length and no end: only an implementation that stops reading
      // once the cap is exceeded can complete this at all (NFR-SEC-12).
      const chunk = new Uint8Array(1024 * 1024).fill(0x61);
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          world.streamedBytes = (world.streamedBytes ?? 0) + chunk.byteLength;
          controller.enqueue(chunk);
        },
      });
      return new Response(body, { status: 200, headers: { "content-type": "text/html" } });
    }

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
  this.requestedUrls = [];
  this.dnsAnswers = new Map();
  this.redirects = new Map();
  this.streamedBytes = 0;
  this.fetchTools = buildFetchTools(this.buddyDir, {
    fetchImpl: mockFetchClient(this),
    fetchTimeoutMs: 50,
    // Anything not scripted resolves to a public address.
    lookup: async (hostname: string) => this.dnsAnswers?.get(hostname) ?? ["93.184.216.34"],
  });
});

Given(
  "the host {string} resolves to {string}",
  function (this: FetchWorld, hostname: string, address: string) {
    this.dnsAnswers!.set(hostname, [address]);
  },
);

Given(
  "{string} redirects to {string}",
  function (this: FetchWorld, from: string, to: string) {
    this.redirects!.set(from, to);
  },
);

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

// --- NFR-SEC-12 ---

Then("the fetch is refused as unsafe", function (this: FetchWorld) {
  assert.ok(
    this.lastToolResult?.startsWith("Refused to fetch"),
    `expected a refusal, got:\n${this.lastToolResult ?? "(none)"}`,
  );
});

Then("no HTTP request is made", function (this: FetchWorld) {
  assert.deepEqual(
    this.requestedUrls,
    [],
    `no request should reach the network, got: ${this.requestedUrls?.join(", ")}`,
  );
});

// --- FR-NET-03 ---

Then("the fetch tool result marks the content as untrusted", function (this: FetchWorld) {
  assert.ok(
    this.lastToolResult?.includes("<untrusted-content"),
    `expected untrusted-content framing, got:\n${this.lastToolResult?.slice(0, 200)}`,
  );
});

Then("the fetch tool result states the content is not instructions", function (this: FetchWorld) {
  assert.match(this.lastToolResult ?? "", /DATA, not instructions/);
});
