# specs/features/prompt-assembly.feature

Feature: System prompt assembly (FR-PROMPT-01, FR-PROMPT-02)
  As the assistant's runtime
  I want the system prompt built from the AB's own files
  So that the agent knows its rules, character, user and pending items

  Background:
    Given an AB directory with identity files

  Scenario: The prompt includes rules, character, user and current date
    When the system prompt is assembled
    Then it contains the AGENTS.md rules
    And it contains the SOUL.md character definition
    And it contains the USER.md profile
    And it contains the current date and time

  Scenario: Due deferred items enrich the prompt
    Given the deferred queue has an item due today and an overdue item
    When the system prompt is assembled
    Then both deferred items are included as pending items to surface

  Scenario: Future deferred items are not included
    Given the deferred queue has only an item due next month
    When the system prompt is assembled
    Then the prompt has no pending items section

  Scenario: Missing identity files do not break assembly
    Given the AB directory has no USER.md
    When the system prompt is assembled
    Then it contains the AGENTS.md rules
    And the prompt has no user profile section
