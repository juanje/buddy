# Contributing — BDD + TDD Development Process

This project follows a strict spec-driven development workflow:
**Specification → BDD Features → TDD Implementation**.

## The Workflow

```
1. Read the spec (specs/SPEC.md)
   ↓ pick a Functional Requirement by ID (e.g., FR-CHAT-01)
2. Write a .feature file (specs/features/*.feature)
   ↓ translate Given/When/Then from the spec into Gherkin
3. Write step definitions (tests/steps/*.ts)
   ↓ make the feature file executable
4. Implement the code (TDD: red → green → refactor)
   ↓ one feature at a time, tests pass before moving on
5. Commit with reference to the FR ID
   ↓ e.g., "feat(chat): FR-CHAT-01 streaming message display"
```

## Phase Order

Implement in phase order. Within a phase, order by dependency:

### Phase 0 — Architecture PoC
1. FR-CHAT-02 (user input + send) — needs the basic Tauri window + worker
2. FR-CHAT-01 (streaming display) — needs Pi SDK session + subscribe
3. FR-CHAT-03 (abort) — needs streaming to be working first
4. FR-CHAT-07 (auto-scroll) — UI polish, last

### Phase 1 — MVP
Start after Phase 0 is green. Order:
1. FR-SETUP-01/02/03 (wizard + AB creation) — bootstraps everything else
2. FR-PROMPT-01 (system prompt assembly) — needed before any real conversation
3. FR-PERM-01/02 (basic zones) — needed before the agent touches files
4. FR-SESSION-01/02 (resume + new session) — continuity
5. FR-REFLECT-01/02 (skeleton + catch-up) — memory persistence
6. FR-DEFERRED-01 (surface on start) — task awareness
7. FR-INGEST-01/02 (drag & drop) — capture for non-technical users
8. FR-GIT-01/02 (auto-commit + index) — invisible persistence

## Writing .feature Files

Feature files live in `specs/features/` and use Gherkin syntax:

```gherkin
# specs/features/chat-streaming.feature

Feature: Streaming message display
  As a user
  I want to see the assistant's response appear in real-time
  So that I know it's working and can read as it generates

  Background:
    Given the app is running
    And the Pi SDK session is connected

  Scenario: Basic streaming response
    Given the chat is idle
    When I send the message "Hello, who are you?"
    Then a typing indicator appears
    And text begins appearing token-by-token in an assistant bubble
    And the typing indicator disappears when the response completes

  Scenario: Multiple messages in sequence
    Given the assistant has finished a response
    When I send another message "Tell me more"
    Then a new assistant bubble appears below the previous one
    And text streams into the new bubble

  Scenario: Long response with auto-scroll
    Given the chat area is scrolled to the bottom
    When the assistant generates a response longer than the viewport
    Then the chat auto-scrolls to keep the latest text visible
```

```gherkin
# specs/features/chat-abort.feature

Feature: Abort generation
  As a user
  I want to stop the assistant mid-response
  So that I can redirect the conversation or save time

  Scenario: Abort via button
    Given the assistant is streaming a response
    When I click the abort button
    Then the streaming stops within 1 second
    And the partial response remains visible
    And the input bar is re-enabled

  Scenario: Abort via keyboard shortcut
    Given the assistant is streaming a response
    When I press Escape
    Then the streaming stops within 1 second
    And the partial response remains visible
```

```gherkin
# specs/features/first-run-wizard.feature

Feature: First-run setup wizard
  As a new user
  I want to be guided through initial setup
  So that my assistant is ready to use without technical knowledge

  Scenario: Fresh install shows wizard
    Given the app is launched for the first time
    And no AB directory is configured
    Then the setup wizard is displayed instead of the chat

  Scenario: Choose AB location
    Given the wizard is on the location step
    When I accept the default location "~/my-ab"
    Then the path is stored for AB directory creation

  Scenario: Choose LLM provider - Anthropic
    Given the wizard is on the provider step
    When I select "Anthropic (Claude)"
    Then an API key input field appears
    When I enter a valid API key
    Then a green checkmark confirms the key works

  Scenario: Complete wizard creates AB
    Given I have completed all wizard steps
    When I click "Start"
    Then the AB directory is created with the expected structure
    And git is initialized in the directory
    And Pi settings are written with my provider choice
    And the wizard transitions to the chat view
    And the agent greets me and begins personalization
```

## Writing Step Definitions

Step definitions translate Gherkin into executable code. We use
a BDD framework compatible with TypeScript (e.g., `cucumber-js` or
`playwright-bdd` for E2E):

```typescript
// tests/steps/chat.steps.ts
import { Given, When, Then } from "@cucumber/cucumber";
import { expect } from "chai";

Given("the app is running", async function () {
    // Verify the Tauri window is open and the worker is connected
    this.app = await launchApp();
    expect(this.app.isRunning()).to.be.true;
});

Given("the Pi SDK session is connected", async function () {
    // Verify the worker has established a Pi session
    const state = await this.app.worker.getState();
    expect(state).to.not.be.null;
});

When("I send the message {string}", async function (message: string) {
    await this.app.chat.sendMessage(message);
});

Then("text begins appearing token-by-token in an assistant bubble", async function () {
    // Wait for at least one message_update event
    const bubble = await this.app.chat.waitForAssistantBubble();
    expect(bubble.isStreaming).to.be.true;
    expect(bubble.text.length).to.be.greaterThan(0);
});
```

## Commit Convention

```
feat(scope): FR-ID description
test(scope): FR-ID feature/step definitions
fix(scope): FR-ID fix description
docs: update spec/docs
chore: tooling, deps, config
```

Examples:
```
feat(chat): FR-CHAT-01 streaming message display
test(chat): FR-CHAT-01 feature file + step definitions
feat(wizard): FR-SETUP-01 first-run wizard UI
fix(permissions): FR-PERM-02 identity files not prompting confirmation
```

## Project Structure (target)

```
ab-app/
├── docs/                        # Design docs (principles, tech spec)
├── specs/
│   ├── SPEC.md                  # Functional/non-functional requirements
│   └── features/                # Gherkin .feature files
│       ├── chat-streaming.feature
│       ├── chat-abort.feature
│       ├── first-run-wizard.feature
│       └── ...
├── src-tauri/                   # Rust shell (minimal)
│   └── src/main.rs
├── backends/                    # Node.js worker (Pi SDK, all logic)
│   ├── agent-worker.ts
│   ├── permissions.ts
│   ├── hebbian.ts
│   ├── consolidation.ts
│   ├── scheduler.ts
│   ├── setup.ts
│   ├── sync.ts
│   └── reflect.ts
├── shared/
│   └── api.ts                   # WorkerAPI + FrontendAPI types
├── src/                         # Frontend (Svelte)
│   ├── App.svelte
│   └── lib/
├── tests/
│   ├── steps/                   # Step definitions
│   ├── unit/                    # Unit tests (vitest)
│   └── fixtures/                # Test data
├── templates/                   # AB structure templates (bundled)
├── package.json
├── CONTRIBUTING.md              # This file
└── README.md
```

## Testing Commands (once scaffolded)

```bash
# Unit tests
npm run test:unit

# Feature tests (BDD)
npm run test:features

# E2E tests
npm run test:e2e

# All tests
npm test
```

## Key Principles

1. **Never implement without a test first.** Write the .feature file, then
   the step definitions, then the code. If you can't write a test, the
   requirement isn't clear enough — go back to the spec.

2. **One feature at a time.** Don't start FR-CHAT-02 until FR-CHAT-01 is
   green. Dependencies are explicit in the phase order above.

3. **The spec is the source of truth.** If the code and the spec disagree,
   the code is wrong (or the spec needs updating — but discuss first).

4. **Commit often, commit small.** One commit per feature or logical unit.
   Reference the FR-ID in every commit message.

5. **Unit tests for deterministic logic, feature tests for behavior.**
   Permission zone classification → unit test. "User drops file and agent
   reads it" → feature test. Both are needed.
