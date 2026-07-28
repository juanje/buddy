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

  # Deleted with its sibling in setup-provider.feature: the "custom" provider is
  # no longer reachable from the wizard (FR-PROVIDER-01). The free-form model
  # input still exists in ModelStep.svelte and is the right design — it is kept
  # for when the provider works end to end, rather than deleted and rewritten.
