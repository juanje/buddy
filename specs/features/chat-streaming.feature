# specs/features/chat-streaming.feature

Feature: Streaming message display (FR-CHAT-01)
  As a user
  I want to see the assistant's response appear in real-time
  So that I know it's working and can read as it generates

  Background:
    Given the app is running
    And the Pi SDK session is connected

  Scenario: Basic streaming response
    Given the chat is idle
    When I send the message "Hello, who are you?"
    Then a typing indicator appears
    And text begins appearing token-by-token in an assistant bubble
    And the typing indicator disappears when the response completes
    And the input bar is re-enabled

  Scenario: Multiple messages in sequence
    Given the assistant has finished a response
    When I send another message "Tell me more"
    Then a new assistant bubble appears below the previous one
    And text streams into the new bubble
    And the previous bubble remains unchanged

  Scenario: Empty response handled gracefully
    Given the chat is idle
    When the assistant produces an empty response
    Then no empty bubble is shown
    And the input bar is re-enabled
