# specs/features/chat-abort.feature

Feature: Abort generation (FR-CHAT-03)
  As a user
  I want to stop the assistant mid-response
  So that I can redirect the conversation or save time

  Background:
    Given the app is running
    And the Pi SDK session is connected

  Scenario: Abort via button
    Given the assistant is streaming a response
    When I click the abort button
    Then the streaming stops within 2 seconds
    And the partial response remains visible in the chat
    And the input bar is re-enabled
    And the send button replaces the abort button

  Scenario: Abort via Escape key
    Given the assistant is streaming a response
    When I press Escape
    Then the streaming stops within 2 seconds
    And the partial response remains visible in the chat
    And the input bar is re-enabled

  Scenario: Abort when no streaming is no-op
    Given the chat is idle
    When I press Escape
    Then nothing happens
    And the input bar remains focused
