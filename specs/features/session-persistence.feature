# FR-REFLECT-05 — Session path persistence and crash recovery

Feature: Session path persistence and crash recovery
  As a user who might experience app crashes
  I want my session to be recoverable on next boot
  So that conversations are never lost

  Background:
    Given an initialized buddy git repository for session persistence

  Scenario: Session path is persisted at session start
    When a new session starts with file "/tmp/session-abc.jsonl"
    Then consolidation-state.json contains liveSessionFile "/tmp/session-abc.jsonl"
    And consolidation-state.json has reflectPending false

  Scenario: Reflect pending is marked on shutdown
    Given a session is running with persisted path "/tmp/session-abc.jsonl"
    When the app shuts down gracefully
    Then consolidation-state.json has reflectPending true
    And a session-end reflect spawn was requested for "/tmp/session-abc.jsonl"

  Scenario: Crash recovery forks stale session on boot
    Given consolidation-state.json has liveSessionFile "/tmp/session-old.jsonl" and reflectPending true
    When the app boots
    Then a session-end reflect spawn was requested for "/tmp/session-old.jsonl"
    And consolidation-state.json has reflectPending false
    And consolidation-state.json has liveSessionFile cleared

  Scenario: No recovery when reflect completed normally
    Given consolidation-state.json has liveSessionFile "/tmp/session-old.jsonl" and reflectPending false
    When the app boots
    Then no reflect spawn was requested
