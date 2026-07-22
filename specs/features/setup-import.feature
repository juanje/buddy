# specs/features/setup-import.feature

Feature: Import existing AB instance (FR-SETUP-08)
  As a user who already has an AB directory
  I want the app to adopt it as-is
  So that my assistant's memory survives a reinstall or a new machine

  Scenario: An existing AB with Pi settings is adopted directly
    Given an existing AB directory with Pi settings
    And the configured provider has valid auth credentials
    When the user imports it from the location step
    Then the app is configured to use that directory
    And no file inside the AB directory is modified

  Scenario: Import with Pi settings but missing auth asks for re-authentication
    Given an existing AB directory with Pi settings
    And the configured provider has no auth credentials
    When the user imports it from the location step
    Then the wizard continues to the provider step in import mode
    And the provider step is pre-selected with the instance provider

  Scenario: Platform artifacts are ignored during import
    Given an existing AB directory containing platform artifacts
    When the user imports it from the location step
    Then the app is configured to use that directory
    And the platform artifacts remain untouched

  Scenario: An existing AB without Pi settings asks for provider and model
    Given an existing AB directory without Pi settings
    When the user imports it from the location step
    Then the wizard continues to the provider step in import mode
    And completing the wizard adopts the directory without copying templates

  Scenario: Adopting with OpenAI maps provider correctly
    Given an existing AB directory without Pi settings
    When the wizard adopts it with provider "openai"
    Then ".pi/settings.json" contains defaultProvider "openai-codex"
