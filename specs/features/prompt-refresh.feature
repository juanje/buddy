# NFR-MIGRATE-06 — Boot refresh on app version change

Feature: Boot refresh on app version change
  As an app user receiving updates
  I want bundled global content updated automatically with each version
  So that I always get the latest prompts and docs without manual steps

  Background:
    Given a global config directory

  Scenario: Bundled content refreshes when app version differs
    Given config.json has last_app_version "0.1.0"
    And the current app version is "0.2.0"
    When the boot sequence runs boot refresh
    Then all bundled prompts are copied to the global prompts directory
    And all bundled docs are copied to the global docs directory
    And config.json should have last_app_version "0.2.0"

  Scenario: No refresh when version matches
    Given config.json has last_app_version "0.2.0"
    And the current app version is "0.2.0"
    When the boot sequence runs boot refresh
    Then prompts directory is unchanged

  Scenario: Fresh install with no config.json
    Given config.json does not exist
    And the current app version is "0.1.0"
    When the boot sequence runs boot refresh
    Then all bundled prompts are copied to the global prompts directory
    And all bundled docs are copied to the global docs directory
    And config.json should have last_app_version "0.1.0"
