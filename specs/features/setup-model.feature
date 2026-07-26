# specs/features/setup-model.feature

Feature: Model selection (FR-SETUP-06)
  As a new user who connected a provider
  I want to pick a model with clear guidance
  So that I get a sensible default without understanding model names

  Background:
    Given the setup wizard is on the model step for the "anthropic" provider

  Scenario: Models are listed with a recommended default preselected
    Then the available models for the provider are listed
    And each model shows a tier description
    And the recommended model is preselected
    And the wizard allows proceeding to the next step

  Scenario: Choosing a different model stores it
    When the user selects another model from the list
    Then the chosen model is stored for setup
    And the wizard allows proceeding to the next step

  Scenario: OpenAI-compatible providers take a free-form model id
    Given the setup wizard is on the model step for the "custom" provider
    Then no model list is available for the provider
    And the wizard does not allow proceeding
    When the user types the model id "my-local-model"
    Then the chosen model is stored for setup
    And the wizard allows proceeding to the next step
