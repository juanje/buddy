# NFR-MIGRATE-06 — Prompt refresh on app version change

Feature: Prompt refresh on app version change
  As an app user receiving updates
  I want my prompts updated automatically with each version
  So that I always get the latest improvements without manual steps

  Background:
    Given a global config directory with schema version 1

  Scenario: Prompts refresh when app version differs
    Given config.json has last_app_version "0.1.0"
    And the current app version is "0.2.0"
    When the boot sequence runs prompt refresh
    Then all bundled prompts are copied to the global prompts directory
    And config.json should have last_app_version "0.2.0"

  Scenario: No refresh when version matches
    Given config.json has last_app_version "0.2.0"
    And the current app version is "0.2.0"
    When the boot sequence runs prompt refresh
    Then prompts directory is unchanged

  Scenario: Fresh install with no config.json
    Given config.json does not exist
    And the current app version is "0.1.0"
    When the boot sequence runs prompt refresh
    Then all bundled prompts are copied to the global prompts directory
    And config.json should have last_app_version "0.1.0"
