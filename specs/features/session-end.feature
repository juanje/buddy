# FR-SESSION-03 + FR-REFLECT-01 — Session end skeleton

Feature: Session end skeleton
  As a user
  I want the app to capture what happened when I close it
  So that nothing is lost between sessions

  Background:
    Given an initialized AB git repository
    And the app is running with memory lifecycle enabled

  Scenario: Shutdown writes a reflect-pending session log
    When the agent writes file "user/inbox.md"
    And the agent turn ends
    And the app shuts down
    Then a session log exists with status "reflect-pending"
    And the session logs index lists the session
