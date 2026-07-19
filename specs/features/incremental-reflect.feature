# FR-REFLECT-03 — Incremental mid-session reflect

Feature: Incremental mid-session reflect
  As a user
  I want long sessions encoded before compaction
  So that context is not lost when the window compresses

  Background:
    Given an initialized AB git repository
    And the app is running with memory lifecycle enabled
    And incremental reflect runs every 2 turns

  Scenario: Turn threshold writes an incremental snapshot
    When the agent writes file "user/inbox.md"
    And the agent turn ends
    And the agent writes file "user/notes.md"
    And the agent turn ends
    Then an incremental snapshot exists for turn 2

  Scenario: Compaction trigger writes an incremental snapshot
    When the agent writes file "user/inbox.md"
    And compaction starts
    Then an incremental snapshot exists
