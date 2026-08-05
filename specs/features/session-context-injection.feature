# specs/features/session-context-injection.feature

Feature: Session-start context message (FR-PROMPT-02)
  As the assistant's runtime
  I want episodic context delivered separately from the system prompt
  So that logs and deferred items do not compete with identity for attention

  Background:
    Given a buddy directory with identity files

  Scenario: Due deferred items enrich the session context
    Given the deferred queue has an item due today and an overdue item
    When the session context is assembled
    Then both deferred items are included as pending items to surface
    And the session context message is non-empty

  Scenario: Future deferred items are not included
    Given the deferred queue has only an item due next month
    When the session context is assembled
    Then the session context has no pending items section

  Scenario: Session logs are included in context
    Given the buddy directory has session logs
    When the session context is assembled
    Then the session context includes the sessions index
    And the session context includes the last session log

  Scenario: Session context always includes the current date
    When the session context is assembled
    Then the session context includes the current date in plain language

  Scenario: Only the date when nothing episodic applies
    When the session context is assembled
    Then the session context has no pending items section
    And the session context has no sessions index
