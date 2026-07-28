# specs/features/setup-import.feature

Feature: Import existing buddy instance (FR-SETUP-10)
  As a user who already has a buddy directory
  I want the app to adopt it as-is
  So that my assistant's memory survives a reinstall or a new machine

  Scenario: An existing buddy instance with Pi settings is adopted directly
    Given an existing buddy directory with Pi settings
    And the configured provider has valid auth credentials
    When the user imports it from the location step
    Then the app is configured to use that directory
    And no pre-existing file is modified
    And buddy's runtime state is gitignored

  Scenario: Import with Pi settings but missing auth asks for re-authentication
    Given an existing buddy directory with Pi settings
    And the configured provider has no auth credentials
    When the user imports it from the location step
    Then the wizard continues to the provider step in import mode
    And the provider step is pre-selected with the instance provider

  Scenario: Platform artifacts are ignored during import
    Given an existing buddy directory containing platform artifacts
    When the user imports it from the location step
    Then the app is configured to use that directory
    And the platform artifacts remain untouched

  Scenario: An existing buddy instance without Pi settings asks for provider and model
    Given an existing buddy directory without Pi settings
    When the user imports it from the location step
    Then the wizard continues to the provider step in import mode
    And completing the wizard adopts the directory without copying templates

  Scenario: Adopting with OpenAI maps provider correctly
    Given an existing buddy directory without Pi settings
    When the wizard adopts it with provider "openai"
    Then ".pi/settings.json" contains defaultProvider "openai-codex"
