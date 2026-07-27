# specs/features/consolidation-scheduler.feature

Feature: Consolidation scheduler (FR-CONSOL-01/02/04/05/06/08/09, FR-COST-05, FR-DEFERRED-02)
  As the Buddy worker
  I want a heartbeat to evaluate deferred items and consolidation counters
  So that maintenance runs autonomously without interrupting the user

  Background:
    Given a buddy directory prepared for consolidation

  Scenario: Heartbeat surfaces due deferred items
    Given the deferred queue has an item due today
    When the heartbeat ticks
    Then deferred due notification is sent

  Scenario: Consolidation runs when session threshold is met and user is idle
    Given 3 sessions have completed since the last consolidation
    And there is new content since the last consolidation
    And the user is not streaming
    When the heartbeat ticks
    Then daily consolidation runs at depth 1

  Scenario: Consolidation defers while the user is streaming
    Given 3 sessions have completed since the last consolidation
    And there is new content since the last consolidation
    And the user is streaming
    When the heartbeat ticks
    Then consolidation does not run

  Scenario: Cascade runs lower depths before higher depth
    Given depth 2 consolidation is due
    And there is new content since the last consolidation
    And the user is not streaming
    When the heartbeat ticks
    Then consolidation runs depths 1 and 2 in order

  Scenario: Consolidation defers when maintenance lock is held
    Given 3 sessions have completed since the last consolidation
    And there is new content since the last consolidation
    And the maintenance lock is held
    When consolidation is triggered at depth 1
    Then consolidation does not run

  Scenario: Consolidation run is recorded in the journal
    Given 3 sessions have completed since the last consolidation
    And there is new content since the last consolidation
    When consolidation is triggered at depth 1
    Then a success entry is appended to the consolidation log

  Scenario: Fresh instance does not consolidate before 3 sessions
    Given 1 session has completed since the last consolidation
    And consolidation has never run before
    And there is new content since the last consolidation
    And the user is not streaming
    When the heartbeat ticks
    Then consolidation does not run

  # --- FR-CONSOL-08: work already paid for is never discarded ---

  Scenario: A failure at depth 2 keeps the advance earned at depth 1
    # Each depth is a billed LLM call. State used to be saved only after the
    # whole cascade, so a late failure silently threw away earlier work and the
    # next run paid for it again.
    Given depth 2 consolidation is due
    And there is new content since the last consolidation
    And the maintenance session fails at depth 2
    When consolidation is triggered at depth 2
    Then depth 1 counters are persisted
    And depth 2 counters are not advanced

  # --- FR-CONSOL-09: a broken depth cannot retry forever ---

  Scenario: A failure is recorded against the depth that failed
    Given 3 sessions have completed since the last consolidation
    And there is new content since the last consolidation
    And the maintenance session fails at depth 1
    When consolidation is triggered at depth 1
    Then the failure count for depth 1 is 1
    And a fail entry is appended to the consolidation log

  Scenario: A depth in backoff is not retried on the next tick
    Given 3 sessions have completed since the last consolidation
    And there is new content since the last consolidation
    And depth 1 has 1 recent consecutive failure
    And the user is not streaming
    When the heartbeat ticks
    Then consolidation does not run

  Scenario: Backoff expires and the depth is retried
    Given 3 sessions have completed since the last consolidation
    And there is new content since the last consolidation
    And depth 1 has 1 consecutive failure from long ago
    And the user is not streaming
    When the heartbeat ticks
    Then daily consolidation runs at depth 1

  Scenario: A depth is abandoned after reaching the retry ceiling
    Given 3 sessions have completed since the last consolidation
    And there is new content since the last consolidation
    And depth 1 has reached the retry ceiling
    And the user is not streaming
    When the heartbeat ticks
    Then consolidation does not run
    And the user is told background maintenance is paused

  Scenario: A successful run clears the failure count
    Given 3 sessions have completed since the last consolidation
    And there is new content since the last consolidation
    And depth 1 has 1 consecutive failure from long ago
    When consolidation is triggered at depth 1
    Then the failure count for depth 1 is 0

  # --- FR-COST-05: the budget gate stops a cascade already running ---

  Scenario: Crossing the budget threshold mid-cascade stops at the next depth
    # The 95% gate previously only prevented a cascade from starting, so a
    # depth-3 cascade begun at 70% could run three billed calls past the ceiling.
    Given depth 3 consolidation is due
    And there is new content since the last consolidation
    And the budget threshold is crossed after depth 1
    When consolidation is triggered at depth 3
    Then only depth 1 runs
    And depth 1 counters are persisted
    And a budget-stopped entry is appended to the consolidation log
