# FR-REFLECT-01/02 — Daily agent log from reflect pipeline

Feature: Reflect writes daily agent log
  As a user
  I want sessions reflected into daily log files
  So that my assistant's memory accumulates in a portable format

  Background:
    Given an initialized AB git repository
    And the app is running with memory lifecycle enabled

  Scenario: Shutdown creates pending skeleton outside logs/
    When the agent writes file "user/inbox.md"
    And the agent turn ends
    And the app shuts down
    Then a pending reflect skeleton exists with status "reflect-pending"
    And no files exist in "logs/" except "index.md"

  Scenario: Catch-up reflect appends to daily log and deletes pending
    Given a pending reflect skeleton exists
    When catch-up reflect runs
    Then a daily log exists for the skeleton's date
    And the daily log contains a session header
    And the pending skeleton is deleted

  Scenario: Cross-midnight session logs to start date
    Given a pending reflect skeleton from a session starting "2026-07-20T23:45" ending "2026-07-21T00:15"
    When catch-up reflect runs
    Then a daily log exists for "2026-07-20"
    And no daily log exists for "2026-07-21"
