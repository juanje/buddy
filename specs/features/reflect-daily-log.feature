# FR-REFLECT-01 — Daily agent log from reflect pipeline

Feature: Reflect writes daily agent log
  As a user
  I want sessions reflected into daily log files
  So that my assistant's memory accumulates in a portable format

  Background:
    Given an initialized AB git repository

  Scenario: Session-end reflect appends to daily log
    Given a reflect finalization with date "2026-07-23" and header "14:30–15:45"
    When finalization runs with sections "### Context\nWorked on feature X"
    Then a daily log exists for "2026-07-23"
    And the daily log contains heading "## Session 14:30–15:45"

  Scenario: Cross-midnight session logs to start date
    Given a reflect finalization with date "2026-07-20" and header "23:45–00:15"
    When finalization runs with sections "### Context\nLate session"
    Then a daily log exists for "2026-07-20"
    And no daily log exists for "2026-07-21"
