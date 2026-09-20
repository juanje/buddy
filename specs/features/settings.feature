# specs/features/settings.feature

Feature: Settings UI (FR-SETTINGS-02)
  As a user
  I want to view and adjust app settings
  So that I can see how Buddy is configured and change my language

  Background:
    Given the app is configured with language "es"
    And the chat session is active

  Scenario: Open settings and view current configuration
    When I open settings
    Then the settings panel is visible
    And the settings show language "es"
    And the settings show provider "anthropic"
    And the settings show model "claude-sonnet-5"
    And the settings show directory "/tmp/buddy-test"

  Scenario: Change language in settings
    Given the settings panel is open
    When I change the settings language to "en"
    Then the UI language is "en"
    And the saved config language is "en"

  Scenario: Close settings
    Given the settings panel is open
    When I close settings
    Then the settings panel is hidden

  Scenario: User changes model in settings
    Given the settings panel is open
    When I change the settings model to "claude-haiku-4-5"
    Then the settings show model "claude-haiku-4-5"
    And changeModel was called with provider "anthropic" and model "claude-haiku-4-5"

  Scenario: User adds a provider and switches to its model
    Given the settings panel is open
    When I add provider "openai" in settings
    Then provider "openai" was authenticated in settings
    And the settings model list includes "gpt-5.6-terra"
    When I switch settings model to "gpt-5.6-terra" on provider "openai"
    Then the settings show provider "openai"
    And the settings show model "gpt-5.6-terra"
    And changeModel was called with provider "openai" and model "gpt-5.6-terra"

  @FR-SETTINGS-03b
  Scenario: Switch to a provider added via API key
    Given the settings panel is open
    And "openai" was added via API key
    When I switch settings model to "gpt-5.6-terra" on provider "openai"
    Then the settings show provider "openai"
    And the settings show model "gpt-5.6-terra"
    And changeModel was called with provider "openai" and model "gpt-5.6-terra"

  @FR-SETTINGS-03c
  Scenario: API-key credential is stored under the api-key Pi provider
    Given "openai" provider key was configured via API key
    Then the auth store entry is keyed by Pi provider "openai"

  @FR-SETTINGS-03c
  Scenario: Auth status reports the api-key Pi provider when OpenAI uses API key
    Given the runtime has configured auth for Pi provider "openai"
    Then auth status reports OpenAI with Pi provider "openai"

  @FR-SETTINGS-03b
  Scenario: Model switch failure shows an error instead of silently reverting
    Given the settings panel is open
    And "openai" was added via API key
    And changeModel fails for provider "openai" and model "unknown-model"
    When I switch settings model to "unknown-model" on provider "openai"
    Then the settings show a model switch error
    And the settings show provider "anthropic"
