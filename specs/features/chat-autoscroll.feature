# specs/features/chat-autoscroll.feature

Feature: Auto-scroll with manual override (FR-CHAT-07)
  As a user
  I want the chat to scroll automatically during responses
  But I also want to scroll up to review history without being pulled back

  Background:
    Given the app is running
    And there are several messages in the chat history

  Scenario: Auto-scroll during streaming
    Given the chat is scrolled to the bottom
    When the assistant generates a response longer than the viewport
    Then the chat scrolls to keep the latest text visible

  Scenario: Manual scroll up disables auto-scroll
    Given the assistant is streaming a response
    When I scroll up to review earlier messages
    Then auto-scroll stops
    And a "scroll to bottom" button appears

  Scenario: Scroll-to-bottom button re-enables auto-scroll
    Given I have scrolled up during a streaming response
    And the "scroll to bottom" button is visible
    When I click the "scroll to bottom" button
    Then the chat scrolls to the latest content
    And auto-scroll resumes for the current response

  Scenario: New message from user auto-scrolls
    Given I have scrolled up in the chat history
    When I send a new message
    Then the chat scrolls to the bottom to show my message
    And auto-scroll is re-enabled
