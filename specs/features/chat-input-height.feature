# specs/features/chat-input-height.feature

Feature: Input textarea height reset (FR-CHAT-08)
  As a user
  I want the input bar to return to a compact size after sending
  So that multiline drafts do not leave a tall empty input area

  Background:
    Given the app is running
    And the Pi SDK session is connected

  Scenario: Textarea resets height after sending a multiline message
    Given the input bar is focused
    When I type "First line"
    And I press Shift+Enter
    And I type "Second line"
    And the textarea has grown for multiline input
    And I press Enter
    Then the input bar is cleared
    And the textarea height is reset to compact
