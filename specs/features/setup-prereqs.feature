# specs/features/setup-prereqs.feature

Feature: Prerequisites check (setup wizard)
  As a new user on the setup wizard
  I want the app to verify my system has what it needs
  So that setup does not fail halfway through

  Background:
    Given the setup wizard has started

  Scenario: Git installed lets setup proceed
    Given git is installed on the system
    When the prerequisites check runs
    Then the wizard allows proceeding to the next step

  Scenario: Missing git blocks setup with instructions
    Given git is not installed on the system
    When the prerequisites check runs
    Then a message explains that git is required
    And platform-specific install instructions are shown
    And the wizard does not allow proceeding

  Scenario: Recheck after installing git unblocks setup
    Given git is not installed on the system
    And the prerequisites check runs
    When git becomes available
    And the user retries the prerequisites check
    Then the wizard allows proceeding to the next step
