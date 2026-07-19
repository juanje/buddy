# specs/features/setup-provider.feature

Feature: Provider and API key configuration (FR-SETUP-04)
  As a new user on the setup wizard
  I want to connect my AI provider with an API key
  So that my assistant can think

  Background:
    Given the setup wizard is on the provider step

  Scenario: Selecting a provider asks for an API key
    When the user selects the "anthropic" provider
    Then an API key input is required before proceeding

  Scenario: A valid API key is stored and setup proceeds
    Given the user selects the "anthropic" provider
    When they submit an API key that the provider accepts
    Then the key is stored in the auth file with restrictive permissions
    And the wizard allows proceeding to the next step

  Scenario: An invalid API key blocks setup with an error
    Given the user selects the "anthropic" provider
    When they submit an API key that the provider rejects
    Then a key validation error is shown
    And the wizard does not allow proceeding
    And nothing is stored in the auth file

  Scenario: OpenAI-compatible providers also need a base URL
    Given the user selects the "custom" provider
    Then a base URL input is required before proceeding
    When they provide a base URL and a key the provider accepts
    Then the key is stored in the auth file with restrictive permissions
    And the wizard allows proceeding to the next step
