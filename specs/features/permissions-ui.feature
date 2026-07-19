# specs/features/permissions-ui.feature

Feature: Permission prompt in chat (FR-PERM-07)
  As a user
  I want permission questions to appear as cards in the chat
  So that I can decide without the app freezing or hiding anything

  Background:
    Given the app is running
    And the Pi SDK session is connected

  Scenario: The card shows the operation and the path with actions
    When the agent requests "write" access to "/home/u/Documents/cv.md"
    Then a permission card shows the "write" operation and that path
    And the card offers allow-once and deny actions

  Scenario: Allowing resolves the request
    When the agent requests "read" access to "/tmp/notes.txt"
    And the user allows the permission
    Then the worker receives an allow verdict for that request
    And the card is marked as allowed

  Scenario: Denying resolves the request
    When the agent requests "read" access to "/tmp/notes.txt"
    And the user denies the permission
    Then the worker receives a deny verdict for that request
    And the card is marked as denied

  Scenario: The rest of the UI stays interactive while waiting
    When the agent requests "read" access to "/tmp/notes.txt"
    Then the permission card does not block the chat input
