# NFR-MAINT-01 — Session log retention

Feature: Session log retention
  As a user with limited disk space
  I want old session event logs pruned automatically
  So that debug-only JSONL files don't accumulate indefinitely

  Background:
    Given an initialized AB git repository with session logs directory

  Scenario: Logs older than 7 days are deleted
    Given a session log "2026-07-10.jsonl" from 10 days ago
    And a session log "2026-07-23.jsonl" from 1 day ago
    When session log pruning runs
    Then "2026-07-10.jsonl" is deleted
    And "2026-07-23.jsonl" is preserved

  Scenario: Empty logs directory is a no-op
    Given no session logs exist
    When session log pruning runs
    Then no error occurs

  Scenario: Non-JSONL files are ignored
    Given a file "notes.txt" from 30 days ago in session logs
    When session log pruning runs
    Then "notes.txt" is preserved
