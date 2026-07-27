// tests/steps/markdown-safety.steps.ts — NFR-SEC-10 render safety BDD steps.
// Drives the real renderer used by MessageBubble and FileViewer. No LLM.
//
// Assertions inspect the parsed DOM, not substrings: escaped output
// legitimately still reads like markup while forming no element.

import { Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";

import { renderMarkdown } from "../../src/lib/markdown";
import {
  hasDangerousUrlScheme,
  hasElement,
  hasEventHandlerAttribute,
} from "../support/rendered-markup";

interface MarkdownSafetyWorld {
  rendered?: string;
}

/** Gherkin carries "\n" literally; turn it into real newlines. */
function unescape(text: string): string {
  return text.replace(/\\n/g, "\n");
}

When("the assistant writes {string}", function (this: MarkdownSafetyWorld, markdown: string) {
  this.rendered = renderMarkdown(unescape(markdown));
});

When(
  "the assistant writes a code block with language {string}",
  function (this: MarkdownSafetyWorld, language: string) {
    this.rendered = renderMarkdown(`\`\`\`${language}\nconst x = 1;\n\`\`\``);
  },
);

Then(
  "the rendered markup has no {string} element",
  function (this: MarkdownSafetyWorld, tagName: string) {
    assert.ok(
      !hasElement(this.rendered!, tagName),
      `rendered markup must form no <${tagName}> element: ${this.rendered}`,
    );
  },
);

Then("the rendered markup has no event-handler attributes", function (this: MarkdownSafetyWorld) {
  assert.ok(
    !hasEventHandlerAttribute(this.rendered!),
    `rendered markup must carry no on* attribute: ${this.rendered}`,
  );
});

Then("the rendered markup has no dangerous URL scheme", function (this: MarkdownSafetyWorld) {
  assert.ok(
    !hasDangerousUrlScheme(this.rendered!),
    `rendered markup must carry no javascript:/data:/vbscript: URL: ${this.rendered}`,
  );
});

Then("the rendered HTML contains {string}", function (this: MarkdownSafetyWorld, fragment: string) {
  assert.ok(
    this.rendered!.includes(fragment),
    `rendered HTML must contain ${fragment}: ${this.rendered}`,
  );
});

Then(
  "the rendered HTML shows the escaped text {string}",
  function (this: MarkdownSafetyWorld, fragment: string) {
    assert.ok(
      this.rendered!.includes(fragment),
      `rendered HTML must show escaped ${fragment}: ${this.rendered}`,
    );
  },
);
