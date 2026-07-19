# specs/features/setup-oauth.feature

Feature: OAuth provider login (FR-SETUP-05)
  As a new user on the setup wizard
  I want to sign in with my AI provider account
  So that I don't need to find or paste an API key

  Background:
    Given the setup wizard is on the provider step for OAuth

  Scenario: OAuth sign-in enables proceeding to model selection
    Given the user selects the "openai" provider
    When they sign in with OAuth successfully
    Then the wizard allows proceeding to the next step

  Scenario: OAuth login emits an auth URL for the browser
    Given the user selects the "openai" provider
    When they start OAuth login
    And an auth URL event is received
    Then the auth URL is available for browser open

  Scenario: After OAuth, models are loaded for selection
    Given the user has signed in with OAuth as "openai"
    When the wizard loads models for the provider
    Then models are available for selection
