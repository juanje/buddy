# specs/features/setup-personalization.feature

Feature: Agent-driven personalization (FR-SETUP-07)
  As a brand-new user
  I want the assistant to introduce itself and get to know me
  So that USER.md fills up conversationally instead of via forms

  Background:
    Given a buddy directory with identity files

  Scenario: A placeholder profile triggers the personalization instructions
    Given USER.md is still the placeholder template
    When the system prompt is assembled
    Then the prompt instructs the agent to introduce itself
    And the prompt instructs the agent to ask for name, language, interests and preferences
    And the prompt instructs the agent to write the answers to USER.md as it learns them

  Scenario: A personalized profile does not trigger the interview
    Given USER.md already has the user's name filled in
    When the system prompt is assembled
    Then the prompt has no personalization instructions

  Scenario: A missing profile also triggers personalization
    Given the buddy directory has no USER.md
    When the system prompt is assembled
    Then the prompt instructs the agent to introduce itself
