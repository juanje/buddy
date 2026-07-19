# specs/features/chat-input.feature

Feature: User input with send (FR-CHAT-02)
  As a user
  I want to type messages and send them to the assistant
  So that I can have a conversation

  Background:
    Given the app is running
    And the Pi SDK session is connected

  Scenario: Send message with Enter key
    Given the input bar is focused
    When I type "What can you help me with?"
    And I press Enter
    Then my message appears as a user bubble in the chat
    And the input bar is cleared
    And the input bar is disabled while the assistant responds

  Scenario: Newline with Shift+Enter
    Given the input bar is focused
    When I type "First line"
    And I press Shift+Enter
    And I type "Second line"
    Then the input bar shows two lines of text
    When I press Enter
    Then the sent message contains both lines

  Scenario: Cannot send empty message
    Given the input bar is empty
    Then the send button is disabled
    When I press Enter
    Then no message is sent

  Scenario: Input disabled during streaming
    Given the assistant is streaming a response
    Then the input bar is disabled
    And the send button is replaced by an abort button
