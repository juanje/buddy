# specs/features/setup-location.feature

Feature: Location picker (FR-SETUP-04)
  As a new user on the setup wizard
  I want to choose where my assistant will live
  So that its memory is stored where I expect

  Background:
    Given the setup wizard is on the location step

  Scenario: Accepting the default location
    Given the default location does not exist yet
    When the user accepts the proposed location
    Then the location is stored for setup
    And the wizard allows proceeding to the next step

  Scenario: Choosing a custom empty directory
    Given an empty directory chosen by the user
    When the user picks that directory as the location
    Then the location is stored for setup
    And the wizard allows proceeding to the next step

  Scenario: Rejecting a non-empty directory
    Given a directory that already contains files
    When the user picks that directory as the location
    Then the location is rejected with a reason
    And the wizard does not allow proceeding

  Scenario: Existing buddy directory is recognized for import
    Given a directory containing an existing buddy instance
    When the user picks that directory as the location
    Then the wizard offers to import the existing instance
