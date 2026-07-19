# specs/features/chat-display.feature

Feature: Chat display polish (FR-CHAT-05, FR-CHAT-06, FR-DEFERRED-01 visual)
  As a user
  I want tool activity, thinking, and deferred items shown clearly in the chat
  So that I understand what the assistant is doing without cluttering the transcript

  Background:
    Given the app is running
    And the Pi SDK session is connected

  Scenario: Tool calls appear as a collapsed activity block
    Given the chat is idle
    When I send the message "Read my notes"
    And the assistant reads files "/tmp/a.md" and "/tmp/b.md"
    Then a tool activity block shows 2 read operations
    And the tool activity block is collapsed by default

  Scenario: Thinking content attaches to the assistant message collapsed
    Given the chat is idle
    When I send the message "Think about this"
    And the assistant thinks then replies "Here is my answer"
    Then the assistant message includes thinking content
    And the thinking content is not shown in the message text

  Scenario: Welcome banner hides after the first message
    Given the welcome banner is visible
    When I send the message "Hello"
    Then the welcome banner is hidden
