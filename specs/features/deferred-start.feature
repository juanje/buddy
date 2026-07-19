# specs/features/deferred-start.feature

Feature: Surface due deferred items on app start (FR-DEFERRED-01)
  As the assistant's runtime
  I want due and overdue deferred items injected into the system prompt
  So that the agent is aware of them from the first message

  Background:
    Given an AB directory with identity files

  Scenario: Due and overdue items are injected at session start
    Given the deferred queue has an item due today and an overdue item
    When the system prompt is assembled
    Then both deferred items are included as pending items to surface

  Scenario: Nothing due means nothing injected
    Given the deferred queue has only an item due next month
    When the system prompt is assembled
    Then the prompt has no pending items section
