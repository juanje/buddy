# specs/features/setup-provider.feature

Feature: Provider and API key configuration (FR-SETUP-05)
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

  # Deleted: "OpenAI-compatible providers also need a base URL".
  #
  # The scenario passed, and the feature did not work. It drove the wizard
  # controller directly, so it never depended on "custom" being offered in the
  # UI, and it asserted the key reached auth.json — which it did. What no step
  # checked was the base URL, because nothing persists it: the session ended up
  # with a credential and no address to send it to.
  #
  # A green scenario for a broken feature is worse than no scenario. The entry
  # point is gone from the wizard until FR-PROVIDER-01 makes the whole path
  # work; the backend half that does exist (URL validation before the key is
  # sent, NFR-SEC-18) is covered by tests/unit/provider-network.test.ts.
