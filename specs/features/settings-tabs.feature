# FR-SETTINGS-08 / FR-SETTINGS-09 — Settings tab restructure (Sprint 0a)

@FR-SETTINGS-08
Feature: Settings tab system
  As a user
  I want settings organized into General and Integrations tabs
  So that connector configuration has its own space without crowding general options

  Background:
    Given the app is configured with language "es"
    And the chat session is active

  Scenario: Settings opens on General tab by default
    When I open settings
    Then the settings panel is visible
    And the settings active tab is "general"

  Scenario: General tab shows current configuration fields
    When I open settings
    Then the settings active tab is "general"
    And the settings show language "es"
    And the settings show provider "anthropic"
    And the settings show model "claude-sonnet-5"
    And the settings show directory "/tmp/buddy-test"

  Scenario: Integrations tab shows Jira configuration panel
    Given the settings panel is open
    When I switch to the integrations settings tab
    Then the settings active tab is "integrations"
    And the integrations tab shows the Jira panel

  Scenario: Switching back to General preserves configuration
    Given the settings panel is open
    When I switch to the integrations settings tab
    And I switch to the general settings tab
    Then the settings active tab is "general"
    And the settings show language "es"
    And the settings show provider "anthropic"

  Scenario: Version field is not shown in Settings
    Given the settings panel is open
    Then the settings version field is not shown
