# FR-REFLECT-03 — Compaction-triggered checkpoint reflect

Feature: Compaction-triggered checkpoint reflect
  As a user with long sessions
  I want reflect to capture my conversation before Pi compacts context
  So that detail is not lost when the context window compresses

  Background:
    Given an initialized buddy git repository
    And memory lifecycle is tracking reflect spawns

  Scenario: Compaction trigger spawns a checkpoint reflect
    When the agent writes file "user/inbox.md"
    And compaction starts
    Then a checkpoint reflect spawn was requested

  Scenario: No checkpoint without activity
    When compaction starts
    Then no checkpoint reflect was spawned

  Scenario: Turn count alone does NOT trigger checkpoint
    When the agent completes 20 turns with activity
    Then no checkpoint reflect was spawned
