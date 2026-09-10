Feature: Topic transition

  @FR-TOPIC-01
  Scenario: New topic button is present in the input bar
    Given the chat view is active
    Then the input bar contains a "New topic" ghost button

  @FR-TOPIC-02
  Scenario: Start now transitions to a fresh session
    Given an active session with messages
    When the user triggers "Start now" via new topic
    Then the current session shutdown fires
    And the chat messages are cleared
    And a new session starts
    And no previous session context is injected

  @FR-TOPIC-05
  Scenario: New topic button is disabled during streaming
    Given the assistant is streaming a response
    Then the new topic button is disabled

  @FR-TOPIC-05
  Scenario: New topic button is disabled during transition
    Given a topic transition is in progress
    Then the new topic button is disabled

  @FR-TOPIC-03
  Scenario: Wrap up first lets the user converse before transitioning
    Given an active session with messages
    When the user triggers "Wrap up first" via new topic
    Then the assistant produces a closure summary
    And a "Done" button appears in the chat
    And the user can still send messages

  @FR-TOPIC-03
  Scenario: Clicking Done after wrap-up transitions to a fresh session
    Given a wrap-up closure is in progress
    When the user clicks "Done"
    Then the current session shutdown fires
    And the chat messages are cleared
    And a new session starts

  @FR-TOPIC-04
  Scenario: New topic labels respect locale
    Given the app language is "es"
    Then the new topic button reads "Nuevo tema"
