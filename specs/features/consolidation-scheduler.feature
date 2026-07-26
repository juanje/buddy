# specs/features/consolidation-scheduler.feature

Feature: Consolidation scheduler (FR-CONSOL-01/02/04/05/06, FR-DEFERRED-02)
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
