// tests/steps/path-autolink.steps.ts — FR-CHAT-16 path auto-linking BDD steps.
//
// Asserts on the rendered HTML because that is what {@html} binds and what the
// user sees. Local links carry `data-local-path` and an inert href (FR-CHAT-09);
// external ones keep a real href.

import { Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";

import { renderMarkdown } from "../../src/lib/markdown";

interface AutolinkWorld {
  html?: string;
}

/** Every anchor in the output, as raw tag + inner HTML. */
function anchors(html: string): { tag: string; inner: string }[] {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({
    tag: m[1],
    inner: m[2],
  }));
}

When("the assistant says {string}", function (this: AutolinkWorld, text: string) {
  this.html = renderMarkdown(text);
});

When(
  "the assistant says a fenced code block containing {string}",
  function (this: AutolinkWorld, text: string) {
    this.html = renderMarkdown(["```", text, "```"].join("\n"));
  },
);

Then(
  "the rendered message links {string} labelled {string}",
  function (this: AutolinkWorld, path: string, label: string) {
    const match = anchors(this.html!).find((a) => a.tag.includes(`data-local-path="${path}"`));
    assert.ok(match, `no local link for ${path} in: ${this.html}`);
    assert.equal(match.inner, label);
  },
);

Then(
  "the rendered message contains exactly {int} link(s)",
  function (this: AutolinkWorld, count: number) {
    assert.equal(anchors(this.html!).length, count, `in: ${this.html}`);
  },
);

Then("the rendered message has no nested links", function (this: AutolinkWorld) {
  for (const anchor of anchors(this.html!)) {
    assert.ok(!anchor.inner.includes("<a "), `nested link in: ${this.html}`);
  }
});

Then("the rendered message shows the text {string}", function (this: AutolinkWorld, text: string) {
  assert.ok(this.html!.includes(text), `missing ${text} in: ${this.html}`);
});

Then(
  "the rendered message links to the external URL {string}",
  function (this: AutolinkWorld, url: string) {
    assert.ok(this.html!.includes(`href="${url}"`), `in: ${this.html}`);
  },
);

Then("the rendered message shows no img element", function (this: AutolinkWorld) {
  assert.ok(!this.html!.includes("<img"), `img element emitted in: ${this.html}`);
});
