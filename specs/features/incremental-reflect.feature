# FR-REFLECT-03 — Checkpoint mid-session reflect

Feature: Checkpoint mid-session reflect
  As a user
  I want long sessions encoded before compaction
  So that context is not lost when the window compresses

  Background:
    Given an initialized AB git repository
    And checkpoint reflect runs every 2 turns

  Scenario: Turn threshold spawns a checkpoint reflect
    When the agent writes file "user/inbox.md"
    And the agent turn ends
    And the agent writes file "user/notes.md"
    And the agent turn ends
    Then a checkpoint reflect spawn was requested at turn 2

  Scenario: Compaction trigger spawns a checkpoint reflect
    When the agent writes file "user/inbox.md"
    And compaction starts
    Then a checkpoint reflect spawn was requested
