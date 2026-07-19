# FR-GIT-01 — Auto-commit after agent writes

Feature: Auto-commit after agent writes
  As a user
  I want the app to persist agent file changes automatically
  So that my assistant's memory survives restarts without manual git

  Background:
    Given an initialized AB git repository
    And the app is running with memory lifecycle enabled

  Scenario: Agent write triggers a batch commit on turn end
    When the agent writes file "user/inbox.md"
    And the agent turn ends
    Then the AB repository has a new commit
    And the latest commit message starts with "ab:"
