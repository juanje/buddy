# specs/features/setup-first-run.feature

Feature: First-run detection (FR-SETUP-01)
  As a new user
  I want the app to detect that nothing is configured yet
  So that I am guided through setup instead of landing in a broken chat

  Scenario: Fresh machine shows the setup wizard
    Given no buddy configuration file exists
    When the app launches
    Then the setup wizard is shown instead of the chat view

  Scenario: Configured buddy opens the chat directly
    Given a configuration file pointing to a buddy directory
    When the app launches
    Then the chat view is shown

  Scenario: Configuration without a buddy directory shows the wizard
    Given a configuration file without a buddy directory
    When the app launches
    Then the setup wizard is shown instead of the chat view

  Scenario: Corrupted configuration file shows the wizard
    Given a corrupted configuration file
    When the app launches
    Then the setup wizard is shown instead of the chat view
