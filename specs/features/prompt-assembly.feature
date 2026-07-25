# specs/features/prompt-assembly.feature

Feature: System prompt assembly (FR-PROMPT-01)
  As the assistant's runtime
  I want the system prompt built from identity and rules only
  So that stable behavior is not diluted by episodic session context

  Background:
    Given a buddy directory with identity files

  Scenario: The prompt includes rules, character, user and current date
    When the system prompt is assembled
    Then it contains the AGENTS.md rules
    And it contains the SOUL.md character definition
    And it contains the USER.md profile
    And it contains the current date and time

  Scenario: The system prompt excludes episodic context
    Given the deferred queue has an item due today and an overdue item
    And the buddy directory has session logs
    When the system prompt is assembled
    Then the prompt has no pending items section
    And the prompt has no sessions index section
    And the prompt has no last session log section

  Scenario: Missing identity files do not break assembly
    Given the buddy directory has no USER.md
    When the system prompt is assembled
    Then it contains the AGENTS.md rules
    And the prompt has no user profile section
