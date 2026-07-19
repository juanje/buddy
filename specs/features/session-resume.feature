# specs/features/session-resume.feature

Feature: Resume last session on start (FR-SESSION-01)
  As a returning user
  I want the app to pick up my last conversation
  So that the assistant remembers where we left off

  Scenario: A previous session is resumed with its history
    Given a previous session with messages exists for the AB
    When the worker initializes its session manager
    Then the most recent session is resumed
    And the prior conversation messages are present

  Scenario: A fresh AB starts a new session
    Given no previous session exists for the AB
    When the worker initializes its session manager
    Then a new empty session is started
